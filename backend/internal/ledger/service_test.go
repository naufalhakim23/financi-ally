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
