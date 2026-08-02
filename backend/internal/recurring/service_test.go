package recurring

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
)

// fixture is one seeded user with an expense + asset account and a service
// wired to the same pool, so tests can assert on the ledger the scheduler wrote
// to as well as on the rule itself.
type fixture struct {
	svc      *Service
	pool     *pgxpool.Pool
	ledgerID string
	food     *ledger.Account
	bca      *ledger.Account
}

// newTestService builds a recurring Service against a real Postgres plus a
// fresh user and a couple of accounts. Skipped when DATABASE_URL is unset.
func newTestService(t *testing.T) (*fixture, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping recurring integration test")
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

	f := &fixture{pool: pool}
	f.svc = NewService(NewRepo(pool), ledger.NewService(ledger.NewRepo(pool)), time.UTC)
	f.ledgerID, f.food, f.bca = seedUser(t, pool, "recurring@example.com")
	return f, func() { pool.Close() }
}

// seedUser registers a user and gives them an expense + asset account.
func seedUser(t *testing.T, pool *pgxpool.Pool, email string) (string, *ledger.Account, *ledger.Account) {
	t.Helper()
	ctx := context.Background()
	authSvc := auth.NewService(auth.NewRepo(pool), auth.NewJWTService("test-secret", time.Minute),
		auth.NewGoogle("", ""), time.Hour, "IDR")
	user, err := authSvc.Register(ctx, email, "password123", "IDR")
	if err != nil {
		t.Fatalf("register %s: %v", email, err)
	}
	ledgerID := personalLedger(t, pool, user.User.ID)
	ledSvc := ledger.NewService(ledger.NewRepo(pool))
	food, err := ledSvc.CreateAccount(ctx, ledgerID, "", "expense", "IDR", "Food", nil)
	if err != nil {
		t.Fatalf("create food account: %v", err)
	}
	bca, err := ledSvc.CreateAccount(ctx, ledgerID, "", "asset", "IDR", "BCA", nil)
	if err != nil {
		t.Fatalf("create BCA account: %v", err)
	}
	return ledgerID, food, bca
}

// tmpl builds a balanced rent-style template against the fixture's accounts.
func (f *fixture) tmpl() Template {
	return Template{
		Currency: "IDR",
		Memo:     "Rent",
		Source:   "recurring",
		Lines: []TemplateLine{
			{AccountID: f.food.ID, DC: "debit", AmountMinor: 2000000},
			{AccountID: f.bca.ID, DC: "credit", AmountMinor: 2000000},
		},
	}
}

// entryCount counts posted entries for a rule, which is what actually proves
// the scheduler didn't double-post.
func (f *fixture) entryCount(t *testing.T, ruleID string) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM entries WHERE recurring_rule_id = $1`, ruleID).Scan(&n); err != nil {
		t.Fatalf("count entries: %v", err)
	}
	return n
}

func (f *fixture) entryDates(t *testing.T, ruleID string) []time.Time {
	t.Helper()
	rows, err := f.pool.Query(context.Background(),
		`SELECT txn_date FROM entries WHERE recurring_rule_id = $1 ORDER BY txn_date`, ruleID)
	if err != nil {
		t.Fatalf("query entry dates: %v", err)
	}
	defer rows.Close()
	var out []time.Time
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			t.Fatalf("scan date: %v", err)
		}
		out = append(out, d)
	}
	return out
}

func today() time.Time {
	n := time.Now().UTC()
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
}

// TestCreateRecurringRule creates a rule and verifies it persists and computes
// next_run correctly.
func TestCreateRecurringRule(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=MONTHLY;BYMONTHDAY=15", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create rule: %v", err)
	}
	if rule.ID == "" {
		t.Fatal("expected non-empty id")
	}
	if rule.NextRun == nil {
		t.Fatal("expected non-nil next_run")
	}
	if rule.NextRun.Day() != 15 {
		t.Fatalf("expected next_run day 15, got %s", rule.NextRun)
	}
	if rule.NextRun.Before(today()) {
		t.Fatalf("expected next_run in the future, got %s", rule.NextRun)
	}
	if !rule.Active {
		t.Fatal("expected active=true")
	}

	rules, err := f.svc.List(ctx, f.ledgerID)
	if err != nil {
		t.Fatalf("list rules: %v", err)
	}
	if len(rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(rules))
	}
}

// TestCreateRecurringRuleInvalidInput verifies validation rejects bad inputs at
// write time rather than failing silently on every scheduler tick.
func TestCreateRecurringRuleInvalidInput(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	line := func(acct, dc string, amt int64) TemplateLine {
		return TemplateLine{AccountID: acct, DC: dc, AmountMinor: amt}
	}
	pair := func(lines ...TemplateLine) Template {
		return Template{Currency: "IDR", Lines: lines}
	}

	tests := []struct {
		name  string
		rrule string
		tmpl  Template
		want  error
	}{
		{"empty rrule", "", pair(line(f.food.ID, "debit", 100), line(f.bca.ID, "credit", 100)), ErrInvalidInput},
		{"malformed rrule", "NOT-AN-RRULE", pair(line(f.food.ID, "debit", 100), line(f.bca.ID, "credit", 100)), ErrInvalidInput},
		{"bad currency", "FREQ=MONTHLY", Template{Currency: "XYZ123", Lines: []TemplateLine{line(f.food.ID, "debit", 100), line(f.bca.ID, "credit", 100)}}, ErrInvalidInput},
		{"single line", "FREQ=MONTHLY", pair(line(f.food.ID, "debit", 100)), ErrInvalidInput},
		{"empty account", "FREQ=MONTHLY", pair(line("", "debit", 100), line(f.bca.ID, "credit", 100)), ErrInvalidInput},
		{"bad dc", "FREQ=MONTHLY", pair(line(f.food.ID, "invalid", 100), line(f.bca.ID, "credit", 100)), ErrInvalidInput},
		{"zero amount", "FREQ=MONTHLY", pair(line(f.food.ID, "debit", 0), line(f.bca.ID, "credit", 100)), ErrInvalidInput},
		{"line currency mismatch", "FREQ=MONTHLY", Template{Currency: "IDR", Lines: []TemplateLine{
			{AccountID: f.food.ID, DC: "debit", AmountMinor: 100, Currency: "USD"},
			{AccountID: f.bca.ID, DC: "credit", AmountMinor: 100},
		}}, ErrInvalidInput},
		{"unbalanced", "FREQ=MONTHLY", pair(line(f.food.ID, "debit", 100), line(f.bca.ID, "credit", 90)), ErrUnbalancedTemplate},
		{"unknown account", "FREQ=MONTHLY", pair(line("no-such-account", "debit", 100), line(f.bca.ID, "credit", 100)), ErrAccountNotUsable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := f.svc.Create(ctx, f.ledgerID, "", tt.rrule, tt.tmpl, true)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

// TestDeleteRecurringRule verifies soft-delete and idempotency.
func TestDeleteRecurringRule(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=MONTHLY;BYMONTHDAY=1", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := f.svc.Delete(ctx, f.ledgerID, rule.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := f.svc.Delete(ctx, f.ledgerID, rule.ID); err != nil {
		t.Fatalf("delete again: %v", err)
	}

	rules, err := f.svc.List(ctx, f.ledgerID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rules) != 0 {
		t.Fatalf("expected 0 rules after delete, got %d", len(rules))
	}
	if _, err := f.svc.Get(ctx, f.ledgerID, rule.ID); !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("expected ErrRuleNotFound, got %v", err)
	}
}

// TestMaterializeDue is the regression test for the two scheduler bugs: a daily
// rule must post exactly one entry, dated today (not tomorrow), and must then
// advance so repeated sweeps are no-ops instead of re-posting the same day.
func TestMaterializeDue(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=DAILY", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create daily rule: %v", err)
	}
	if rule.NextRun == nil || !rule.NextRun.Equal(today()) {
		t.Fatalf("expected a daily rule to be due today (%s), got %v", today(), rule.NextRun)
	}

	count, err := f.svc.MaterializeDue(ctx)
	if err != nil {
		t.Fatalf("materialize due: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 materialized entry, got %d", count)
	}

	dates := f.entryDates(t, rule.ID)
	if len(dates) != 1 || !dates[0].UTC().Equal(today()) {
		t.Fatalf("expected exactly one entry dated today (%s), got %v", today(), dates)
	}

	updated, err := f.svc.Get(ctx, f.ledgerID, rule.ID)
	if err != nil {
		t.Fatalf("get updated rule: %v", err)
	}
	if updated.LastRun == nil || !updated.LastRun.Equal(today()) {
		t.Fatalf("expected last_run=today, got %v", updated.LastRun)
	}
	if updated.NextRun == nil || !updated.NextRun.Equal(today().AddDate(0, 0, 1)) {
		t.Fatalf("expected next_run to advance to tomorrow, got %v", updated.NextRun)
	}

	// Repeated sweeps in the same day must be no-ops — the scheduler runs every
	// few minutes, so a non-advancing rule would flood the ledger.
	for i := 0; i < 3; i++ {
		count, err = f.svc.MaterializeDue(ctx)
		if err != nil {
			t.Fatalf("materialize due (repeat %d): %v", i, err)
		}
		if count != 0 {
			t.Fatalf("repeat sweep %d: expected 0 materializations, got %d", i, count)
		}
	}
	if n := f.entryCount(t, rule.ID); n != 1 {
		t.Fatalf("expected 1 entry after repeated sweeps, got %d", n)
	}
}

// TestMaterializeIsIdempotentPerOccurrence forces the rule back to an already-
// posted occurrence — what a concurrent replica or a replayed sweep does — and
// verifies the DB guard, not just the advance logic, prevents a double post.
func TestMaterializeIsIdempotentPerOccurrence(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=DAILY", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := f.svc.MaterializeDue(ctx); err != nil {
		t.Fatalf("first sweep: %v", err)
	}

	if _, err := f.pool.Exec(ctx,
		`UPDATE recurring_rules SET next_run = $2 WHERE id = $1`, rule.ID, today()); err != nil {
		t.Fatalf("rewind next_run: %v", err)
	}

	count, err := f.svc.MaterializeDue(ctx)
	if err != nil {
		t.Fatalf("second sweep: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 new entries for an already-posted occurrence, got %d", count)
	}
	if n := f.entryCount(t, rule.ID); n != 1 {
		t.Fatalf("expected 1 entry, got %d", n)
	}
}

// TestMaterializeCatchesUpMissedOccurrences verifies downtime doesn't lose
// occurrences: a rule whose start predates today posts every missed day in one
// sweep, each on its own date.
func TestMaterializeCatchesUpMissedOccurrences(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	start := today().AddDate(0, 0, -3)
	rrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY", start.Format("20060102T150405Z"))
	rule, err := f.svc.Create(ctx, f.ledgerID, "", rrule, f.tmpl(), true)
	if err != nil {
		t.Fatalf("create backdated rule: %v", err)
	}
	if rule.NextRun == nil || !rule.NextRun.Equal(today()) {
		t.Fatalf("expected first pending occurrence today, got %v", rule.NextRun)
	}

	// Rewind to the true start so the sweep has 4 days (start..today) to catch up.
	if _, err := f.pool.Exec(ctx,
		`UPDATE recurring_rules SET next_run = $2 WHERE id = $1`, rule.ID, start); err != nil {
		t.Fatalf("rewind next_run: %v", err)
	}

	count, err := f.svc.MaterializeDue(ctx)
	if err != nil {
		t.Fatalf("catch-up sweep: %v", err)
	}
	if count != 4 {
		t.Fatalf("expected 4 caught-up entries, got %d", count)
	}
	dates := f.entryDates(t, rule.ID)
	for i, d := range dates {
		want := start.AddDate(0, 0, i)
		if !d.UTC().Equal(want) {
			t.Fatalf("entry %d: expected %s, got %s", i, want, d)
		}
	}
	updated, err := f.svc.Get(ctx, f.ledgerID, rule.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if updated.NextRun == nil || !updated.NextRun.Equal(today().AddDate(0, 0, 1)) {
		t.Fatalf("expected next_run tomorrow after catch-up, got %v", updated.NextRun)
	}
}

// TestMaterializeDueForLedgerIsScoped verifies the manual trigger can't post into
// another tenant's ledger.
func TestMaterializeDueForLedgerIsScoped(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	mine, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=DAILY", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create own rule: %v", err)
	}

	otherID, otherFood, otherBCA := seedUser(t, f.pool, "other@example.com")
	otherTmpl := Template{Currency: "IDR", Lines: []TemplateLine{
		{AccountID: otherFood.ID, DC: "debit", AmountMinor: 100},
		{AccountID: otherBCA.ID, DC: "credit", AmountMinor: 100},
	}}
	theirs, err := f.svc.Create(ctx, otherID, "", "FREQ=DAILY", otherTmpl, true)
	if err != nil {
		t.Fatalf("create other rule: %v", err)
	}

	count, err := f.svc.MaterializeDueForLedger(ctx, f.ledgerID)
	if err != nil {
		t.Fatalf("scoped materialize: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 entry for the caller, got %d", count)
	}
	if n := f.entryCount(t, theirs.ID); n != 0 {
		t.Fatalf("expected the other user's rule untouched, got %d entries", n)
	}
	if n := f.entryCount(t, mine.ID); n != 1 {
		t.Fatalf("expected 1 entry for own rule, got %d", n)
	}
}

// TestMaterializeRecordsFailure verifies a rule that can no longer post surfaces
// why on the rule itself instead of only in the server log.
func TestMaterializeRecordsFailure(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=DAILY", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	// Archive the account behind the template — the everyday way a rule goes bad.
	if _, err := f.pool.Exec(ctx,
		`UPDATE accounts SET archived = true WHERE id = $1`, f.food.ID); err != nil {
		t.Fatalf("archive account: %v", err)
	}

	count, err := f.svc.MaterializeDue(ctx)
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 entries posted, got %d", count)
	}

	updated, err := f.svc.Get(ctx, f.ledgerID, rule.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if updated.LastError == nil || *updated.LastError == "" {
		t.Fatal("expected last_error to be recorded")
	}
	if updated.LastErrorAt == nil {
		t.Fatal("expected last_error_at to be set")
	}
	// next_run must not advance past a failed occurrence — the entry is still owed.
	if updated.NextRun == nil || !updated.NextRun.Equal(today()) {
		t.Fatalf("expected next_run to stay on the failed occurrence, got %v", updated.NextRun)
	}
}

// TestUpdateRecurringRule verifies an edit recomputes the schedule and clears a
// stale error.
func TestUpdateRecurringRule(t *testing.T) {
	f, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	rule, err := f.svc.Create(ctx, f.ledgerID, "", "FREQ=DAILY", f.tmpl(), true)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := f.svc.MaterializeDue(ctx); err != nil {
		t.Fatalf("sweep: %v", err)
	}

	tmpl := f.tmpl()
	tmpl.Memo = "Rent (updated)"
	updated, err := f.svc.Update(ctx, f.ledgerID, rule.ID, "FREQ=DAILY", tmpl, true)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Template.Memo != "Rent (updated)" {
		t.Fatalf("expected updated memo, got %q", updated.Template.Memo)
	}
	// Today is already posted, so the edit must schedule the next one, not a repeat.
	if updated.NextRun == nil || !updated.NextRun.Equal(today().AddDate(0, 0, 1)) {
		t.Fatalf("expected next_run tomorrow after edit, got %v", updated.NextRun)
	}

	count, err := f.svc.MaterializeDue(ctx)
	if err != nil {
		t.Fatalf("post-update sweep: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no re-post of today's occurrence, got %d", count)
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
