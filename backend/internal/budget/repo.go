package budget

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Data-origin sentinel errors.
var (
	// ErrBudgetNotFound: no budget matched the lookup in this ledger.
	ErrBudgetNotFound = errors.New("budget not found")
	// ErrBudgetExists: unused for now (Upsert handles conflicts); kept for symmetry.
	ErrBudgetExists = errors.New("budget already exists")
)

// Repo is the persistence boundary for budgets. Raw SQL via pgx.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const colBudget = "id, ledger_id, account_id, period_month, target_minor, currency, created_at, updated_at"

func scanBudget(row pgx.Row) (*Budget, error) {
	b := &Budget{}
	if err := row.Scan(&b.ID, &b.LedgerID, &b.AccountID, &b.PeriodMonth, &b.TargetMinor,
		&b.Currency, &b.CreatedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return b, nil
}

// Upsert creates or updates a budget for (ledger, account, month) with an
// explicit id (client or server generated). ON CONFLICT (ledger, account, month)
// updates the target and bumps updated_at — re-setting a target is the normal
// edit path; the conflict key ignores id so a re-push of the same client budget
// updates in place rather than colliding.
func (r *Repo) Upsert(ctx context.Context, id, ledgerID, accountID string, period time.Time, currency string, target int64) (*Budget, error) {
	const q = `INSERT INTO budgets (id, ledger_id, account_id, period_month, target_minor, currency)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (ledger_id, account_id, period_month) DO UPDATE
		  SET target_minor = EXCLUDED.target_minor, updated_at = now(), deleted_at = NULL
		RETURNING ` + colBudget
	b, err := scanBudget(r.db.QueryRow(ctx, q, id, ledgerID, accountID, period, target, currency))
	if err != nil {
		return nil, fmt.Errorf("upsert budget: %w", err)
	}
	return b, nil
}

// List returns a ledger's budgets for a month.
func (r *Repo) List(ctx context.Context, ledgerID string, period time.Time) ([]*Budget, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+colBudget+` FROM budgets WHERE ledger_id = $1 AND period_month = $2 AND deleted_at IS NULL ORDER BY target_minor DESC`, ledgerID, period)
	if err != nil {
		return nil, fmt.Errorf("list budgets: %w", err)
	}
	defer rows.Close()
	var out []*Budget
	for rows.Next() {
		b, err := scanBudget(rows)
		if err != nil {
			return nil, fmt.Errorf("scan budget: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Get fetches one budget, scoped to the ledger.
func (r *Repo) Get(ctx context.Context, ledgerID, id string) (*Budget, error) {
	b, err := scanBudget(r.db.QueryRow(ctx,
		`SELECT `+colBudget+` FROM budgets WHERE id = $1 AND ledger_id = $2 AND deleted_at IS NULL`, id, ledgerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBudgetNotFound
		}
		return nil, fmt.Errorf("get budget: %w", err)
	}
	return b, nil
}

// UpdateTarget changes a budget's target and bumps updated_at.
func (r *Repo) UpdateTarget(ctx context.Context, ledgerID, id string, target int64) (*Budget, error) {
	b, err := scanBudget(r.db.QueryRow(ctx,
		`UPDATE budgets SET target_minor = $3, updated_at = now()
		  WHERE id = $1 AND ledger_id = $2 AND deleted_at IS NULL RETURNING `+colBudget, id, ledgerID, target))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBudgetNotFound
		}
		return nil, fmt.Errorf("update budget: %w", err)
	}
	return b, nil
}

// Delete soft-deletes a budget (sets deleted_at + updated_at) so WatermelonDB
// sync can communicate the deletion on pull. Idempotent.
func (r *Repo) Delete(ctx context.Context, ledgerID, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE budgets SET deleted_at = now(), updated_at = now()
		  WHERE id = $1 AND ledger_id = $2 AND deleted_at IS NULL`, id, ledgerID)
	if err != nil {
		return fmt.Errorf("delete budget: %w", err)
	}
	return nil
}

// SpentForAccount sums posted debit lines on the account within [start, end).
// For an expense account (normal debit) this is the month's spend.
func (r *Repo) SpentForAccount(ctx context.Context, ledgerID, accountID string, start, end time.Time) (int64, error) {
	var spent int64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(jl.amount_minor), 0)
		FROM journal_lines jl
		JOIN entries e ON e.id = jl.entry_id
		WHERE jl.account_id = $1 AND e.ledger_id = $2
		  AND e.status = 'posted' AND e.deleted_at IS NULL
		  AND jl.dc = 'debit'
		  AND e.txn_date >= $3 AND e.txn_date < $4`,
		accountID, ledgerID, start, end).Scan(&spent)
	if err != nil {
		return 0, fmt.Errorf("spent for account: %w", err)
	}
	return spent, nil
}
