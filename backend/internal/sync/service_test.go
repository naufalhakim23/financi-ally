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
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
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
		`TRUNCATE TABLE oauth_identities, refresh_tokens, journal_lines, entries, accounts, budgets, users RESTART IDENTITY CASCADE`); err != nil {
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
	svc := NewService(NewRepo(pool), ledSvc, budSvc)
	return svc, user.User.ID, func() { pool.Close() }
}

// TestPushThenPull posts a client entry via push, then pulls and expects it
// back — proving the offline write path round-trips and the balance invariant
// is enforced on push.
func TestPushThenPull(t *testing.T) {
	svc, userID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	// Client (WMB-style) ids: arbitrary client-generated strings.
	bcaID := "wmb-bca-001"
	foodID := "wmb-food-001"
	entryID := "wmb-entry-001"
	lineD := "wmb-line-d"
	lineC := "wmb-line-c"

	// Push: one account pair + a balanced entry (debit Groceries, credit BCA).
	_, err := svc.Push(ctx, userID, PushRequest{Changes: ChangeSet{
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
	pull, err := svc.Pull(ctx, userID, 0)
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
	pull2, err := svc.Pull(ctx, userID, pull.Timestamp)
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
	svc, userID, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	bcaID := "wmb-bca-002"
	foodID := "wmb-food-002"
	// Set the accounts up first so the entry's only failure is balance.
	_, _ = svc.Push(ctx, userID, PushRequest{Changes: ChangeSet{
		"accounts": {Created: []map[string]any{
			{"id": bcaID, "type": "asset", "currency": "IDR", "name": "BCA2", "archived": false},
			{"id": foodID, "type": "expense", "currency": "IDR", "name": "Food2", "archived": false},
		}},
	}})

	resp, err := svc.Push(ctx, userID, PushRequest{Changes: ChangeSet{
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
