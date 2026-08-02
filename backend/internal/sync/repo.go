package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo is the cross-table persistence boundary for sync. Unlike the per-feature
// repos it spans accounts/entries/journal_lines/budgets because the WMB
// protocol is inherently cross-table; scoping a sync repo to one table would
// just spread the same joins across packages.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the sync repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

// App-field column lists per table — exactly what the mobile WatermelonDB model
// defines, and ONLY those (server bookkeeping columns like ledger_id, created_at,
// updated_at, deleted_at are never sent; WMB manages created_at/updated_at
// locally and uses our server updated_at only for the pull filter).
var tableColumns = map[string]string{
	"accounts": "id, type, currency, name, parent_id, archived",
	"entries":  "id, txn_date, status, currency, fx_rate, source, memo",
	// journal_lines pulls join entries (which also has id/currency), so qualify.
	"journal_lines": "jl.id, jl.entry_id, jl.account_id, jl.dc, jl.amount_minor, jl.currency",
	"budgets":       "id, account_id, period_month, target_minor, currency",
	// template::text so the JSONB arrives as a string — WatermelonDB columns are
	// scalars, so the client stores the template as a JSON string and parses it.
	"recurring_rules": "id, rrule, template::text AS template, next_run, last_run, active",
}

// Now returns the pull's snapshot bound: the database's clock, rounded up to
// the next whole millisecond.
//
// Not time.Now(): rows are stamped by Postgres, so any host/database clock skew
// makes a Go timestamp skip rows that already exist. Rounded because the bound
// must equal the millisecond watermark returned with it — at microsecond
// precision the sub-millisecond tail is re-sent as "created" on the next pull
// and WMB rejects it as a duplicate id. Up rather than down, or those same rows
// fall outside the bound and wait a pull.
func (r *Repo) Now(ctx context.Context) (time.Time, error) {
	var now time.Time
	if err := r.db.QueryRow(ctx, `SELECT now()`).Scan(&now); err != nil {
		return time.Time{}, fmt.Errorf("sync clock: %w", err)
	}
	if rounded := now.Truncate(time.Millisecond); rounded.Before(now) {
		return rounded.Add(time.Millisecond), nil
	}
	return now, nil
}

// PullCreated returns records created since the watermark (created_at > since).
// Uses an as-of timestamp `asOf` so the pull sees a consistent snapshot.
func (r *Repo) PullCreated(ctx context.Context, ledgerID, table string, since, asOf time.Time) ([]map[string]any, error) {
	cols, ok := tableColumns[table]
	if !ok {
		return nil, fmt.Errorf("unknown sync table %q", table)
	}
	var q string
	switch table {
	case "journal_lines":
		// Lines have no timestamps of their own (immutable); a line exists from
		// the moment its entry was posted, so filter on the entry's created_at.
		q = fmt.Sprintf(`SELECT %s FROM journal_lines jl
			JOIN entries e ON e.id = jl.entry_id
			WHERE e.ledger_id = $1 AND e.deleted_at IS NULL
			  AND e.created_at > $2 AND e.created_at <= $3`, cols)
	default:
		q = fmt.Sprintf(`SELECT %s FROM %s
			WHERE ledger_id = $1 AND deleted_at IS NULL
			  AND created_at > $2 AND created_at <= $3`, cols, table)
	}
	return queryMaps(r.db.Query(ctx, q, ledgerID, since, asOf))
}

// PullUpdated returns records modified (but not first-created) since the
// watermark: updated_at > since AND created_at <= since.
func (r *Repo) PullUpdated(ctx context.Context, ledgerID, table string, since, asOf time.Time) ([]map[string]any, error) {
	cols, ok := tableColumns[table]
	if !ok {
		return nil, fmt.Errorf("unknown sync table %q", table)
	}
	// journal_lines are immutable — they are created with their entry and never
	// updated, so there is no "updated" delta for them.
	if table == "journal_lines" {
		return nil, nil
	}
	q := fmt.Sprintf(`SELECT %s FROM %s
		WHERE ledger_id = $1 AND deleted_at IS NULL
		  AND updated_at > $2 AND updated_at <= $3
		  AND created_at <= $2`, cols, table)
	return queryMaps(r.db.Query(ctx, q, ledgerID, since, asOf))
}

// PullDeleted returns ids soft-deleted since the watermark. Entries carry the
// deletion flag for their lines too — a line has no deleted_at of its own — so
// journal_lines resolves through its entry.
func (r *Repo) PullDeleted(ctx context.Context, ledgerID, table string, since, asOf time.Time) ([]string, error) {
	var q string
	switch table {
	case "accounts", "budgets", "recurring_rules", "entries":
		q = fmt.Sprintf(`SELECT id FROM %s WHERE ledger_id = $1 AND deleted_at > $2 AND deleted_at <= $3`, table)
	case "journal_lines":
		q = `SELECT jl.id FROM journal_lines jl
			JOIN entries e ON e.id = jl.entry_id
			WHERE e.ledger_id = $1 AND e.deleted_at > $2 AND e.deleted_at <= $3`
	default:
		return nil, nil
	}
	rows, err := r.db.Query(ctx, q, ledgerID, since, asOf)
	if err != nil {
		return nil, fmt.Errorf("pull deleted %s: %w", table, err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan deleted id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// UpsertAccount inserts or updates an account by client id (ON CONFLICT id).
// Used by sync push for both created and updated account records.
func (r *Repo) UpsertAccount(ctx context.Context, id, ledgerID, typeStr, currency, name string, parentID *string, archived bool) error {
	var parent any
	if parentID != nil {
		parent = *parentID
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO accounts (id, ledger_id, type, currency, name, parent_id, archived, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
		ON CONFLICT (id) DO UPDATE
		  SET type = EXCLUDED.type, currency = EXCLUDED.currency, name = EXCLUDED.name,
		      parent_id = EXCLUDED.parent_id, archived = EXCLUDED.archived, updated_at = now()
		  WHERE accounts.ledger_id = $2`,
		id, ledgerID, typeStr, currency, name, parent, archived)
	if err != nil {
		return fmt.Errorf("upsert account %s: %w", id, err)
	}
	return nil
}

// SoftDelete marks a record deleted (deleted_at + updated_at = now) for a synced
// mutable table. Only accounts/budgets/recurring_rules are soft-deletable.
func (r *Repo) SoftDelete(ctx context.Context, table, ledgerID, id string) error {
	if table != "accounts" && table != "budgets" && table != "recurring_rules" {
		return nil
	}
	_, err := r.db.Exec(ctx,
		fmt.Sprintf(`UPDATE %s SET deleted_at = now(), updated_at = now() WHERE id = $1 AND ledger_id = $2`, table),
		id, ledgerID)
	if err != nil {
		return fmt.Errorf("soft-delete %s %s: %w", table, id, err)
	}
	return nil
}

// queryMaps scans a (rows, err) pair into a slice of string-keyed maps, keeping
// only the app fields the query selected.
func queryMaps(rows pgx.Rows, err error) ([]map[string]any, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	fields := rows.FieldDescriptions()
	var out []map[string]any
	for rows.Next() {
		vals := make([]any, len(fields))
		ptrs := make([]any, len(fields))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		m := make(map[string]any, len(fields))
		for i, fd := range fields {
			m[fd.Name] = normalize(vals[i])
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// normalize turns pgx-scanned values into JSON-friendly forms: time.Time → ms
// epoch (WMB timestamps are ms), []byte → string. Other types pass through.
func normalize(v any) any {
	switch t := v.(type) {
	case time.Time:
		return t.UnixMilli()
	case []byte:
		return string(t)
	default:
		return v
	}
}
