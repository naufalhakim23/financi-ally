package ledger

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Data-origin sentinel errors. The service layer maps these to HTTP statuses.
var (
	// ErrAccountNotFound: no account matched the lookup for this user.
	ErrAccountNotFound = errors.New("account not found")
	// ErrAccountNameExists: create hit the (user_id, type, name) unique constraint.
	ErrAccountNameExists = errors.New("account name already exists")
	// ErrEntryNotFound: no entry matched the lookup for this user.
	ErrEntryNotFound = errors.New("entry not found")
	// ErrUnbalancedEntry: the entry's debit total ≠ credit total per currency.
	// Surfaced either by the application assert or by the Postgres balance trigger.
	ErrUnbalancedEntry = errors.New("entry is not balanced")
	// ErrDuplicateEntry: the entry id already exists, or this recurring rule has
	// already posted its occurrence for that date. Callers treat it as "already
	// done" rather than a failure — it is what makes posting idempotent under
	// retries, concurrent scheduler ticks, and sync replays.
	ErrDuplicateEntry = errors.New("entry already exists")
)

// Repo is the persistence boundary for the ledger. Raw SQL via pgx; goqu lands
// in M4 with the reporting queries where dynamic composition pays for itself.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const (
	colAccount = "id, user_id, type, currency, name, parent_id, archived, created_at, updated_at, deleted_at"
	colEntry   = "id, user_id, txn_date, status, currency, fx_rate, source, memo, created_at, updated_at"
	colLine    = "id, entry_id, account_id, dc, amount_minor, currency"
)

func scanAccount(row pgx.Row) (*Account, error) {
	a := &Account{}
	if err := row.Scan(&a.ID, &a.UserID, &a.Type, &a.Currency, &a.Name, &a.ParentID,
		&a.Archived, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt); err != nil {
		return nil, err
	}
	return a, nil
}

// CreateAccount inserts a pocket/category with an explicit id (client or server
// generated). A colliding (user_id,type,name) maps to ErrAccountNameExists so
// callers return 409, not 500.
func (r *Repo) CreateAccount(ctx context.Context, id, userID string, t AccountType, currency, name string, parentID *string) (*Account, error) {
	const q = `INSERT INTO accounts (id, user_id, type, currency, name, parent_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + colAccount
	a, err := scanAccount(r.db.QueryRow(ctx, q, id, userID, t, currency, name, parentID))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrAccountNameExists
		}
		return nil, fmt.Errorf("create account: %w", err)
	}
	return a, nil
}

// ListAccounts returns a user's accounts, optionally filtered by type. Archived
// accounts are included (the UI dims them); soft-deleted are excluded.
func (r *Repo) ListAccounts(ctx context.Context, userID string, typeFilter *AccountType) ([]*Account, error) {
	q := `SELECT ` + colAccount + ` FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`
	args := []any{userID}
	if typeFilter != nil {
		args = append(args, *typeFilter)
		q += fmt.Sprintf(` AND type = $%d`, len(args))
	}
	q += ` ORDER BY type, name`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list accounts: %w", err)
	}
	defer rows.Close()
	var out []*Account
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, fmt.Errorf("scan account: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// GetAccount fetches by id, scoped to the user so a cross-user id can't leak.
func (r *Repo) GetAccount(ctx context.Context, userID, id string) (*Account, error) {
	a, err := scanAccount(r.db.QueryRow(ctx,
		`SELECT `+colAccount+` FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, fmt.Errorf("get account: %w", err)
	}
	return a, nil
}

// AccountsByIDs fetches a set of accounts scoped to the user, returning a map
// keyed by id. Used by Post to validate that every line references an owned,
// matching-currency, non-archived account in one query rather than per-line.
func (r *Repo) AccountsByIDs(ctx context.Context, userID string, ids []string) (map[string]*Account, error) {
	if len(ids) == 0 {
		return map[string]*Account{}, nil
	}
	rows, err := r.db.Query(ctx,
		`SELECT `+colAccount+` FROM accounts WHERE user_id = $1 AND id = ANY($2) AND deleted_at IS NULL`,
		userID, ids)
	if err != nil {
		return nil, fmt.Errorf("accounts by ids: %w", err)
	}
	defer rows.Close()
	out := make(map[string]*Account, len(ids))
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, fmt.Errorf("scan account: %w", err)
		}
		out[a.ID] = a
	}
	return out, rows.Err()
}

// AccountTotals sums debit and credit across an account's posted lines. The
// service signs the result by account type. Returns zero/zero for a pocket with
// no activity yet.
func (r *Repo) AccountTotals(ctx context.Context, userID, accountID string) (debit, credit int64, err error) {
	const q = `SELECT
			COALESCE(SUM(jl.amount_minor) FILTER (WHERE jl.dc = 'debit'), 0),
			COALESCE(SUM(jl.amount_minor) FILTER (WHERE jl.dc = 'credit'), 0)
		FROM journal_lines jl
		JOIN entries e ON e.id = jl.entry_id
		WHERE jl.account_id = $1 AND e.user_id = $2 AND e.status = 'posted' AND e.deleted_at IS NULL`
	if err = r.db.QueryRow(ctx, q, accountID, userID).Scan(&debit, &credit); err != nil {
		return 0, 0, fmt.Errorf("account totals: %w", err)
	}
	return debit, credit, nil
}

// PostEntry writes a balanced entry in one transaction: insert the header, then
// batch-insert all lines in a single statement (so the balance trigger sees the
// full set). The service validates ownership and balance before calling; the
// trigger is the server-side backstop and its check_violation maps to
// ErrUnbalancedEntry. fx_rate is set for cross-currency entries (M4).
func (r *Repo) PostEntry(ctx context.Context, userID string, in EntryInput) (*Entry, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin post tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	e := &Entry{}
	err = tx.QueryRow(ctx, `
		INSERT INTO entries (id, user_id, txn_date, status, currency, fx_rate, source, memo, recurring_rule_id)
		VALUES ($1, $2, $3, 'posted', $4, $5, $6, $7, $8)
		RETURNING `+colEntry,
		in.ID, userID, in.TxnDate, in.Currency, in.FXRate, defaultSource(in.Source), in.Memo, in.RecurringRuleID).
		Scan(&e.ID, &e.UserID, &e.TxnDate, &e.Status, &e.Currency, &e.FXRate, &e.Source, &e.Memo, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		// Either the entry id collided or the (rule, occurrence) idempotency
		// index fired — both mean "this entry is already posted".
		if isUniqueViolation(err) {
			return nil, ErrDuplicateEntry
		}
		return nil, fmt.Errorf("insert entry: %w", err)
	}

	// Batch all lines in one statement so the AFTER-INSERT trigger evaluates the
	// complete, balanced set rather than each row piecemeal.
	var b strings.Builder
	b.WriteString(`INSERT INTO journal_lines (id, entry_id, account_id, dc, amount_minor, currency) VALUES `)
	args := make([]any, 0, len(in.Lines)*6)
	for i, ln := range in.Lines {
		if i > 0 {
			b.WriteByte(',')
		}
		base := i * 6
		cur := ln.Currency
		if cur == "" {
			cur = in.Currency
		}
		fmt.Fprintf(&b, `($%d,$%d,$%d,$%d,$%d,$%d)`, base+1, base+2, base+3, base+4, base+5, base+6)
		args = append(args, ln.ID, e.ID, ln.AccountID, ln.DC, ln.AmountMinor, cur)
	}
	b.WriteString(` RETURNING ` + colLine)
	rows, err := tx.Query(ctx, b.String(), args...)
	if err != nil {
		if isCheckViolation(err) {
			return nil, ErrUnbalancedEntry
		}
		return nil, fmt.Errorf("insert lines: %w", err)
	}
	for rows.Next() {
		var jl JournalLine
		if err := rows.Scan(&jl.ID, &jl.EntryID, &jl.AccountID, &jl.DC, &jl.AmountMinor, &jl.Currency); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan line: %w", err)
		}
		e.Lines = append(e.Lines, jl)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		if isCheckViolation(err) {
			return nil, ErrUnbalancedEntry
		}
		return nil, fmt.Errorf("lines result: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		if isCheckViolation(err) {
			return nil, ErrUnbalancedEntry
		}
		return nil, fmt.Errorf("commit post tx: %w", err)
	}
	return e, nil
}

// ListEntries returns a user's posted entries newest-first within an optional
// date range, each with its lines attached.
func (r *Repo) ListEntries(ctx context.Context, userID string, from, to *time.Time) ([]*Entry, error) {
	q := `SELECT ` + colEntry + ` FROM entries WHERE user_id = $1 AND status = 'posted' AND deleted_at IS NULL`
	args := []any{userID}
	if from != nil {
		args = append(args, *from)
		q += fmt.Sprintf(` AND txn_date >= $%d`, len(args))
	}
	if to != nil {
		args = append(args, *to)
		q += fmt.Sprintf(` AND txn_date <= $%d`, len(args))
	}
	q += ` ORDER BY txn_date DESC, created_at DESC`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list entries: %w", err)
	}
	defer rows.Close()
	entries, err := scanEntries(rows)
	if err != nil {
		return nil, err
	}
	return r.attachLines(ctx, entries)
}

// GetEntry fetches one entry with its lines, scoped to the user.
func (r *Repo) GetEntry(ctx context.Context, userID, id string) (*Entry, error) {
	e := &Entry{}
	err := r.db.QueryRow(ctx,
		`SELECT `+colEntry+` FROM entries WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, userID).
		Scan(&e.ID, &e.UserID, &e.TxnDate, &e.Status, &e.Currency, &e.FXRate, &e.Source, &e.Memo, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrEntryNotFound
		}
		return nil, fmt.Errorf("get entry: %w", err)
	}
	attached, err := r.attachLines(ctx, []*Entry{e})
	if err != nil {
		return nil, err
	}
	return attached[0], nil
}

// attachLines loads lines for the given entries in one query and groups them.
func (r *Repo) attachLines(ctx context.Context, entries []*Entry) ([]*Entry, error) {
	if len(entries) == 0 {
		return entries, nil
	}
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.ID
	}
	rows, err := r.db.Query(ctx,
		`SELECT `+colLine+` FROM journal_lines WHERE entry_id = ANY($1) ORDER BY dc, amount_minor DESC`, ids)
	if err != nil {
		return nil, fmt.Errorf("list lines: %w", err)
	}
	defer rows.Close()
	byEntry := make(map[string][]JournalLine, len(entries))
	for rows.Next() {
		var jl JournalLine
		if err := rows.Scan(&jl.ID, &jl.EntryID, &jl.AccountID, &jl.DC, &jl.AmountMinor, &jl.Currency); err != nil {
			return nil, fmt.Errorf("scan line: %w", err)
		}
		byEntry[jl.EntryID] = append(byEntry[jl.EntryID], jl)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lines rows: %w", err)
	}
	for _, e := range entries {
		e.Lines = byEntry[e.ID]
	}
	return entries, nil
}

func scanEntries(rows pgx.Rows) ([]*Entry, error) {
	var out []*Entry
	for rows.Next() {
		e := &Entry{}
		if err := rows.Scan(&e.ID, &e.UserID, &e.TxnDate, &e.Status, &e.Currency, &e.FXRate, &e.Source, &e.Memo, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan entry: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func defaultSource(s string) string {
	if s == "" {
		return "manual"
	}
	return s
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// isCheckViolation maps the balance trigger's check_violation (23514) to
// ErrUnbalancedEntry at the repo boundary.
func isCheckViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23514"
}
