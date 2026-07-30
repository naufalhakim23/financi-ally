// Package budget owns monthly category budgets: a target amount on an expense
// account for a month, plus the live spent total derived from posted debit
// lines. Budgets are a synced mutable (updated_at drives M3 WatermelonDB LWW);
// spent is never stored — it is recomputed from the immutable ledger.
package budget

import "time"

// Budget is a monthly target on an expense account (a category).
type Budget struct {
	ID          string
	UserID      string
	AccountID   string
	PeriodMonth time.Time // first day of the month
	TargetMinor int64
	Currency    string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// BudgetWithSpent carries the live spent total alongside the target. Spent is
// the sum of posted debit lines on the account within the month.
type BudgetWithSpent struct {
	Budget
	SpentMinor int64
}
