package sync

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/budget"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
	"github.com/naufalhakim23/financi-ally/backend/internal/recurring"
)

// newTestService builds a sync Service against a real Postgres plus a fresh
// user. Skipped when DATABASE_URL is unset.
func newTestService(t *testing.T) (*Service, string, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping sync integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE TABLE recurring_rules, ledger_invites, ledger_members, ledgers, oauth_identities, refresh_tokens, journal_lines, entries, accounts, budgets, users RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	authRepo := auth.NewRepo(pool)
	jwt := auth.NewJWTService("test-secret", time.Minute)
	authSvc := auth.NewService(authRepo, jwt, auth.NewGoogle("", ""), time.Hour, "IDR")
	user, err := authSvc.Register(context.Background(), "sync@example.com", "password123", "IDR")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	ledSvc := ledger.NewService(ledger.NewRepo(pool))
	budSvc := budget.NewService(budget.NewRepo(pool), ledSvc)
	recSvc := recurring.NewService(recurring.NewRepo(pool), ledSvc, time.UTC)
	svc := NewService(NewRepo(pool), ledSvc, budSvc, recSvc)
	return svc, personalLedger(t, pool, user.User.ID), func() { pool.Close() }
}

// TestPushThenPull posts a client entry via push, then pulls and expects it
// back — proving the offline write path round-trips and the balance invariant
// is enforced on push.
func TestPushThenPull(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	// Client (WMB-style) ids: arbitrary client-generated strings.
	bcaID := "wmb-bca-001"
	foodID := "wmb-food-001"
	entryID := "wmb-entry-001"
	lineD := "wmb-line-d"
	lineC := "wmb-line-c"

	// Push: one account pair + a balanced entry (debit Groceries, credit BCA).
	_, err := svc.Push(ctx, ledgerID, "", PushRequest{Changes: ChangeSet{
		"accounts": {Created: []map[string]any{
			{"id": bcaID, "type": "asset", "currency": "IDR", "name": "BCA", "archived": false},
			{"id": foodID, "type": "expense", "currency": "IDR", "name": "Groceries", "archived": false},
		}},
		"entries": {Created: []map[string]any{
			{"id": entryID, "currency": "IDR", "txn_date": "2026-07-26", "memo": "Indomaret", "source": "manual"},
		}},
		"journal_lines": {Created: []map[string]any{
			{"id": lineD, "entry_id": entryID, "account_id": foodID, "dc": "debit", "amount_minor": int64(50000), "currency": "IDR"},
			{"id": lineC, "entry_id": entryID, "account_id": bcaID, "dc": "credit", "amount_minor": int64(50000), "currency": "IDR"},
		}},
	}})
	if err != nil {
		t.Fatalf("push: %v", err)
	}

	// First pull (watermark 0) returns everything as created.
	pull, err := svc.Pull(ctx, ledgerID, 0)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if len(pull.Changes["accounts"].Created) != 2 {
		t.Fatalf("accounts created = %d, want 2", len(pull.Changes["accounts"].Created))
	}
	if len(pull.Changes["entries"].Created) != 1 {
		t.Fatalf("entries created = %d, want 1", len(pull.Changes["entries"].Created))
	}
	if len(pull.Changes["journal_lines"].Created) != 2 {
		t.Fatalf("lines created = %d, want 2", len(pull.Changes["journal_lines"].Created))
	}

	// Incremental pull at the returned watermark returns nothing new.
	pull2, err := svc.Pull(ctx, ledgerID, pull.Timestamp)
	if err != nil {
		t.Fatalf("pull2: %v", err)
	}
	if len(pull2.Changes) != 0 {
		t.Fatalf("incremental pull = %d tables, want 0 (got %+v)", len(pull2.Changes), pull2.Changes)
	}
}

// TestPushUnbalancedReported pushes an unbalanced entry; it must land in
// errors keyed by client id, never silently dropped.
func TestPushUnbalancedReported(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bcaID := "wmb-bca-002"
	foodID := "wmb-food-002"
	// Set the accounts up first so the entry's only failure is balance.
	_, _ = svc.Push(ctx, ledgerID, "", PushRequest{Changes: ChangeSet{
		"accounts": {Created: []map[string]any{
			{"id": bcaID, "type": "asset", "currency": "IDR", "name": "BCA2", "archived": false},
			{"id": foodID, "type": "expense", "currency": "IDR", "name": "Food2", "archived": false},
		}},
	}})

	resp, err := svc.Push(ctx, ledgerID, "", PushRequest{Changes: ChangeSet{
		"entries": {Created: []map[string]any{
			{"id": "bad-entry", "currency": "IDR", "txn_date": "2026-07-26"},
		}},
		"journal_lines": {Created: []map[string]any{
			{"id": "bl1", "entry_id": "bad-entry", "account_id": foodID, "dc": "debit", "amount_minor": int64(50000), "currency": "IDR"},
			{"id": "bl2", "entry_id": "bad-entry", "account_id": bcaID, "dc": "credit", "amount_minor": int64(49000), "currency": "IDR"},
		}},
	}})
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if _, ok := resp.Errors["bad-entry"]; !ok {
		t.Fatalf("expected bad-entry in errors, got %+v", resp.Errors)
	}
}

// TestPushPullRecurringRule covers the offline path for M6 rules: a rule
// authored on-device must land on the server (validated like the REST path) and
// come back on the next pull with its template as a JSON string, which is the
// only shape a WatermelonDB column can hold.
func TestPushPullRecurringRule(t *testing.T) {
	svc, ledgerID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bcaID := "wmb-bca-003"
	rentID := "wmb-rent-003"
	ruleID := "wmb-rule-003"
	template := `{"currency":"IDR","memo":"Rent","source":"recurring","lines":[` +
		`{"account_id":"` + rentID + `","dc":"debit","amount_minor":2000000},` +
		`{"account_id":"` + bcaID + `","dc":"credit","amount_minor":2000000}]}`

	resp, err := svc.Push(ctx, ledgerID, "", PushRequest{Changes: ChangeSet{
		"accounts": {Created: []map[string]any{
			{"id": bcaID, "type": "asset", "currency": "IDR", "name": "BCA3", "archived": false},
			{"id": rentID, "type": "expense", "currency": "IDR", "name": "Rent3", "archived": false},
		}},
		"recurring_rules": {Created: []map[string]any{
			{"id": ruleID, "rrule": "FREQ=MONTHLY;BYMONTHDAY=1", "template": template, "active": true},
		}},
	}})
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if len(resp.Errors) > 0 {
		t.Fatalf("expected no push errors, got %+v", resp.Errors)
	}

	pull, err := svc.Pull(ctx, ledgerID, 0)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	rules := pull.Changes["recurring_rules"].Created
	if len(rules) != 1 {
		t.Fatalf("expected 1 recurring rule in pull, got %d", len(rules))
	}
	got := rules[0]
	if got["id"] != ruleID {
		t.Fatalf("expected id %s, got %v", ruleID, got["id"])
	}
	if _, ok := got["template"].(string); !ok {
		t.Fatalf("expected template as a JSON string, got %T", got["template"])
	}
	if got["next_run"] == nil {
		t.Fatal("expected next_run to be scheduled")
	}

	// An unbalanced rule must be reported per-record, never silently dropped.
	bad := `{"currency":"IDR","lines":[` +
		`{"account_id":"` + rentID + `","dc":"debit","amount_minor":100},` +
		`{"account_id":"` + bcaID + `","dc":"credit","amount_minor":90}]}`
	resp, err = svc.Push(ctx, ledgerID, "", PushRequest{Changes: ChangeSet{
		"recurring_rules": {Created: []map[string]any{
			{"id": "wmb-rule-bad", "rrule": "FREQ=MONTHLY", "template": bad, "active": true},
		}},
	}})
	if err != nil {
		t.Fatalf("push bad rule: %v", err)
	}
	if _, ok := resp.Errors["wmb-rule-bad"]; !ok {
		t.Fatalf("expected wmb-rule-bad in errors, got %+v", resp.Errors)
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
