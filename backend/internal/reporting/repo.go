package reporting

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo provides aggregate queries against the ledger.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the reporting repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

// accountBalanceRow is a single account's signed balance.
type accountBalanceRow struct {
	AccountID   string
	SignedMinor int64
	Currency    string
}

// AccountBalancesByType returns the signed balance for every account of the
// given type. Used by net-worth computation.
func (r *Repo) AccountBalancesByType(ctx context.Context, userID, acctType string) ([]accountBalanceRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT a.id, a.type, a.currency,
			COALESCE(SUM(jl.amount_minor) FILTER (WHERE jl.dc = 'debit'), 0) AS debit_total,
			COALESCE(SUM(jl.amount_minor) FILTER (WHERE jl.dc = 'credit'), 0) AS credit_total
		FROM accounts a
		LEFT JOIN journal_lines jl ON jl.account_id = a.id
		LEFT JOIN entries e ON e.id = jl.entry_id AND e.status = 'posted' AND e.deleted_at IS NULL
		WHERE a.user_id = $1 AND a.type = $2 AND a.deleted_at IS NULL
		GROUP BY a.id, a.type, a.currency
		ORDER BY a.name`, userID, acctType)
	if err != nil {
		return nil, fmt.Errorf("account balances by type: %w", err)
	}
	defer rows.Close()
	var out []accountBalanceRow
	for rows.Next() {
		var id, typ, cur string
		var debit, credit int64
		if err := rows.Scan(&id, &typ, &cur, &debit, &credit); err != nil {
			return nil, fmt.Errorf("scan balance row: %w", err)
		}
		signed := debit - credit
		if typ != "asset" && typ != "expense" {
			signed = credit - debit
		}
		out = append(out, accountBalanceRow{
			AccountID:   id,
			SignedMinor: signed,
			Currency:    cur,
		})
	}
	return out, rows.Err()
}

// categorySpendRow is one category's raw spend total.
type categorySpendRow struct {
	AccountID   string
	AccountName string
	Currency    string
	SpentMinor  int64
}

// SpendingByCategory returns total posted debits per expense account within the
// period, per-currency.
func (r *Repo) SpendingByCategory(ctx context.Context, userID string, start, end time.Time) ([]categorySpendRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT a.id, a.name, a.currency, COALESCE(SUM(jl.amount_minor), 0)
		FROM accounts a
		JOIN journal_lines jl ON jl.account_id = a.id
		JOIN entries e ON e.id = jl.entry_id
		WHERE a.user_id = $1 AND a.type = 'expense' AND a.deleted_at IS NULL
		  AND e.status = 'posted' AND e.deleted_at IS NULL
		  AND jl.dc = 'debit'
		  AND e.txn_date >= $2 AND e.txn_date < $3
		GROUP BY a.id, a.name, a.currency
		ORDER BY a.name`, userID, start, end)
	if err != nil {
		return nil, fmt.Errorf("spending by category: %w", err)
	}
	defer rows.Close()
	var out []categorySpendRow
	for rows.Next() {
		var r categorySpendRow
		if err := rows.Scan(&r.AccountID, &r.AccountName, &r.Currency, &r.SpentMinor); err != nil {
			return nil, fmt.Errorf("scan category spend: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// typeTotalRow is a sum of amounts for a given account type.
type typeTotalRow struct {
	AmountMinor int64
	Currency    string
}

// TotalsByType returns total posted debits (for expense) or credits (for income)
// in the period, grouped by currency.
func (r *Repo) TotalsByType(ctx context.Context, userID, acctType string, start, end time.Time) ([]typeTotalRow, error) {
	dcFilter := "debit"
	if acctType == "income" {
		dcFilter = "credit"
	}
	rows, err := r.db.Query(ctx, `
		SELECT jl.currency, COALESCE(SUM(jl.amount_minor), 0)
		FROM accounts a
		JOIN journal_lines jl ON jl.account_id = a.id
		JOIN entries e ON e.id = jl.entry_id
		WHERE a.user_id = $1 AND a.type = $2 AND a.deleted_at IS NULL
		  AND e.status = 'posted' AND e.deleted_at IS NULL
		  AND jl.dc = $3
		  AND e.txn_date >= $4 AND e.txn_date < $5
		GROUP BY jl.currency`, userID, acctType, dcFilter, start, end)
	if err != nil {
		return nil, fmt.Errorf("totals by type %s: %w", acctType, err)
	}
	defer rows.Close()
	var out []typeTotalRow
	for rows.Next() {
		var r typeTotalRow
		if err := rows.Scan(&r.Currency, &r.AmountMinor); err != nil {
			return nil, fmt.Errorf("scan type total: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
