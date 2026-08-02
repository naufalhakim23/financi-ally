package ledger

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
)

// newTestService builds a ledger Service against a real Postgres and a user to
// own the test data. Skipped when DATABASE_URL is unset so `go test ./...`
// passes DB-less. Migrations are applied (idempotent) and ledger tables
// truncated for a clean, re-runnable slate.
func newTestService(t *testing.T) (*Service, string, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping ledger integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE TABLE ledger_invites, ledger_members, ledgers, oauth_identities, refresh_tokens, journal_lines, entries, accounts, users RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	// Fresh user to own the test accounts/entries.
	authRepo := auth.NewRepo(pool)
	jwt := auth.NewJWTService("test-secret", time.Minute)
	authSvc := auth.NewService(authRepo, jwt, auth.NewGoogle("", ""), nil, time.Hour, "IDR")
	user, err := authSvc.Register(context.Background(), "ledger@example.com", "password123", "IDR")
	if err != nil {
		t.Fatalf("register test user: %v", err)
	}
	svc := NewService(NewRepo(pool))
	return svc, personalLedger(t, pool, user.User.ID), func() { pool.Close() }
}

func TestPostBalancedReconciles(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	// BCA (asset pocket) + Groceries (expense category), both IDR.
	bca, err := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	if err != nil {
		t.Fatalf("create bca: %v", err)
	}
	food, err := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)
	if err != nil {
		t.Fatalf("create food: %v", err)
	}

	// Post: debit Groceries 50000, credit BCA 50000 (buying groceries).
	e, err := svc.Post(ctx, ledgerID, "", EntryInput{
		TxnDate:  time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC),
		Currency: "IDR",
		Memo:     "Indomaret",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 50000},
		},
	})
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if len(e.Lines) != 2 || e.Status != "posted" {
		t.Fatalf("unexpected entry: %+v", e)
	}

	// BCA balance: asset → debit−credit = 0−50000 = -50000 (cash went down).
	bcaBal, err := svc.Balance(ctx, ledgerID, bca.ID)
	if err != nil {
		t.Fatalf("bca balance: %v", err)
	}
	if bcaBal.SignedMinor != -50000 {
		t.Fatalf("bca signed = %d, want -50000", bcaBal.SignedMinor)
	}
	// Groceries: expense → debit−credit = 50000.
	foodBal, err := svc.Balance(ctx, ledgerID, food.ID)
	if err != nil {
		t.Fatalf("food balance: %v", err)
	}
	if foodBal.SignedMinor != 50000 {
		t.Fatalf("food signed = %d, want 50000", foodBal.SignedMinor)
	}
}

// The web client renders pockets from the bulk endpoint, so it has to agree
// with the per-account figure it replaced.
func TestBalancesMatchPerAccount(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	food, _ := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)
	visa, _ := svc.CreateAccount(ctx, ledgerID, "", "liability", "IDR", "Visa", nil)
	// Never touched by an entry — must still appear, at zero.
	empty, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "Cash", nil)

	if _, err := svc.Post(ctx, ledgerID, "", EntryInput{
		TxnDate:  time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC),
		Currency: "IDR",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 50000},
		},
	}); err != nil {
		t.Fatalf("post cash purchase: %v", err)
	}
	if _, err := svc.Post(ctx, ledgerID, "", EntryInput{
		TxnDate:  time.Date(2026, 7, 27, 0, 0, 0, 0, time.UTC),
		Currency: "IDR",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 30000},
			{AccountID: visa.ID, DC: DCCredit, AmountMinor: 30000},
		},
	}); err != nil {
		t.Fatalf("post card purchase: %v", err)
	}

	bals, err := svc.Balances(ctx, ledgerID)
	if err != nil {
		t.Fatalf("balances: %v", err)
	}
	got := map[string]int64{}
	for _, b := range bals {
		got[b.AccountID] = b.SignedMinor
	}
	want := map[string]int64{
		bca.ID:   -50000, // asset: debit−credit
		food.ID:  80000,  // expense: debit−credit
		visa.ID:  30000,  // liability: credit−debit, positive means owed
		empty.ID: 0,
	}
	if len(got) != len(want) {
		t.Fatalf("balances returned %d accounts, want %d", len(got), len(want))
	}
	for id, w := range want {
		if got[id] != w {
			t.Errorf("account %s signed = %d, want %d", id, got[id], w)
		}
		// Same number the single-account endpoint reports.
		one, err := svc.Balance(ctx, ledgerID, id)
		if err != nil {
			t.Fatalf("balance %s: %v", id, err)
		}
		if one.SignedMinor != got[id] {
			t.Errorf("account %s: bulk %d != single %d", id, got[id], one.SignedMinor)
		}
	}
}

func TestPostUnbalancedRejected(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	food, _ := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)

	// App-level assert fires before the DB: debit 50000 ≠ credit 49000.
	_, err := svc.Post(ctx, ledgerID, "", EntryInput{
		Currency: "IDR",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 49000},
		},
	})
	if !errors.Is(err, ErrUnbalancedEntry) {
		t.Fatalf("unbalanced post: want ErrUnbalancedEntry, got %v", err)
	}

	// A single-leg entry is rejected as invalid input (can't balance with 1 line).
	_, err = svc.Post(ctx, ledgerID, "", EntryInput{
		Currency: "IDR",
		Lines:    []LineInput{{AccountID: bca.ID, DC: DCDebit, AmountMinor: 100}},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("single-line post: want ErrInvalidInput, got %v", err)
	}
}

func TestTransferBalancesBothPockets(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	gopay, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "GoPay", nil)

	// Transfer: debit GoPay 200000, credit BCA 200000 — money leaves BCA, enters GoPay.
	if _, err := svc.Post(ctx, ledgerID, "", EntryInput{
		Currency: "IDR",
		Memo:     "top up gopay",
		Lines: []LineInput{
			{AccountID: gopay.ID, DC: DCDebit, AmountMinor: 200000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 200000},
		},
	}); err != nil {
		t.Fatalf("transfer post: %v", err)
	}
	bcaBal, _ := svc.Balance(ctx, ledgerID, bca.ID)
	gopayBal, _ := svc.Balance(ctx, ledgerID, gopay.ID)
	if bcaBal.SignedMinor != -200000 || gopayBal.SignedMinor != 200000 {
		t.Fatalf("transfer balances: bca=%d gopay=%d, want -200000 / 200000", bcaBal.SignedMinor, gopayBal.SignedMinor)
	}
}

func TestCrossLedgerAccountRejected(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	food, _ := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)

	// A foreign ledger holds no accounts; referencing ours from its scope is
	// blocked because AccountsByIDs filters on ledger_id.
	_, err := svc.Post(ctx, "00000000-0000-0000-0000-000000000000", "", EntryInput{
		Currency: "IDR",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 50000},
		},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("cross-ledger post: want ErrInvalidInput, got %v", err)
	}
}

// TestDeleteEntryClearsBalances is the invariant behind DELETE /entries/{id}:
// a soft-deleted entry must vanish from the money, not just from the list. The
// lines stay in journal_lines, so if any read path stopped joining entries on
// deleted_at, the balance below would still show the spend.
func TestDeleteEntryClearsBalances(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	food, _ := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)
	e, err := svc.Post(ctx, ledgerID, "", EntryInput{
		Currency: "IDR",
		Memo:     "Indomaret",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 50000},
		},
	})
	if err != nil {
		t.Fatalf("post: %v", err)
	}

	if err := svc.DeleteEntry(ctx, ledgerID, e.ID); err != nil {
		t.Fatalf("delete entry: %v", err)
	}

	bcaBal, _ := svc.Balance(ctx, ledgerID, bca.ID)
	foodBal, _ := svc.Balance(ctx, ledgerID, food.ID)
	if bcaBal.SignedMinor != 0 || foodBal.SignedMinor != 0 {
		t.Fatalf("after delete: bca=%d food=%d, want 0 / 0", bcaBal.SignedMinor, foodBal.SignedMinor)
	}
	if _, err := svc.GetEntry(ctx, ledgerID, e.ID); !errors.Is(err, ErrEntryNotFound) {
		t.Fatalf("get deleted entry: want ErrEntryNotFound, got %v", err)
	}
	list, err := svc.ListEntries(ctx, ledgerID, nil, nil)
	if err != nil || len(list) != 0 {
		t.Fatalf("list after delete: %d entries, err %v", len(list), err)
	}

	// Idempotent — a sync replay must not turn into an error.
	if err := svc.DeleteEntry(ctx, ledgerID, e.ID); err != nil {
		t.Fatalf("second delete: %v", err)
	}
	// An id that never existed is still a 404.
	if err := svc.DeleteEntry(ctx, ledgerID, "no-such-entry"); !errors.Is(err, ErrEntryNotFound) {
		t.Fatalf("delete unknown: want ErrEntryNotFound, got %v", err)
	}
}

// TestUpdateEntryMemo pins the memo as the only mutable field on a posting.
func TestUpdateEntryMemo(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	food, _ := svc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Groceries", nil)
	e, _ := svc.Post(ctx, ledgerID, "", EntryInput{
		Currency: "IDR",
		Memo:     "Indomaret",
		Lines: []LineInput{
			{AccountID: food.ID, DC: DCDebit, AmountMinor: 50000},
			{AccountID: bca.ID, DC: DCCredit, AmountMinor: 50000},
		},
	})

	updated, err := svc.UpdateEntryMemo(ctx, ledgerID, e.ID, "Alfamart")
	if err != nil {
		t.Fatalf("update memo: %v", err)
	}
	if updated.Memo != "Alfamart" || len(updated.Lines) != 2 {
		t.Fatalf("updated entry: memo=%q lines=%d", updated.Memo, len(updated.Lines))
	}
	// Relabelling must not move money.
	foodBal, _ := svc.Balance(ctx, ledgerID, food.ID)
	if foodBal.SignedMinor != 50000 {
		t.Fatalf("food after relabel = %d, want 50000", foodBal.SignedMinor)
	}
	if _, err := svc.UpdateEntryMemo(ctx, ledgerID, "no-such-entry", "x"); !errors.Is(err, ErrEntryNotFound) {
		t.Fatalf("update unknown: want ErrEntryNotFound, got %v", err)
	}
}

// TestUpdateAccount covers rename, archive and restore through the one call.
func TestUpdateAccount(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bca, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	name := "BCA Utama"
	renamed, err := svc.UpdateAccount(ctx, ledgerID, bca.ID, &name, nil)
	if err != nil {
		t.Fatalf("rename: %v", err)
	}
	if renamed.Name != name || renamed.Archived {
		t.Fatalf("renamed: %+v", renamed)
	}

	yes, no := true, false
	archived, err := svc.UpdateAccount(ctx, ledgerID, bca.ID, nil, &yes)
	if err != nil || !archived.Archived || archived.Name != name {
		t.Fatalf("archive: %+v, err %v", archived, err)
	}
	restored, err := svc.UpdateAccount(ctx, ledgerID, bca.ID, nil, &no)
	if err != nil || restored.Archived {
		t.Fatalf("restore: %+v, err %v", restored, err)
	}

	// An empty patch is a caller mistake, not a no-op.
	if _, err := svc.UpdateAccount(ctx, ledgerID, bca.ID, nil, nil); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty patch: want ErrInvalidInput, got %v", err)
	}
	// A blank name would erase the only label the account has.
	blank := "   "
	if _, err := svc.UpdateAccount(ctx, ledgerID, bca.ID, &blank, nil); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("blank name: want ErrInvalidInput, got %v", err)
	}
	if _, err := svc.UpdateAccount(ctx, ledgerID, "no-such-account", &name, nil); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("update unknown: want ErrAccountNotFound, got %v", err)
	}

	// Renaming onto an existing (type, name) is the same 409 as creating one.
	other, _ := svc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "GoPay", nil)
	if _, err := svc.UpdateAccount(ctx, ledgerID, other.ID, &name, nil); !errors.Is(err, ErrAccountNameExists) {
		t.Fatalf("duplicate rename: want ErrAccountNameExists, got %v", err)
	}
}

// personalLedger resolves the user's personal book, creating it the same way a
// first request would. Every service under test is scoped to a ledger id, not a
// user id, so this is what the tests must pass down.
func personalLedger(t *testing.T, pool *pgxpool.Pool, userID string) string {
	t.Helper()
	scope, err := household.NewService(household.NewRepo(pool)).Resolve(context.Background(), userID, "")
	if err != nil {
		t.Fatalf("resolve personal ledger: %v", err)
	}
	return scope.LedgerID
}
