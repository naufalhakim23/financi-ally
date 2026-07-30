// Package reporting generates aggregate views from the immutable ledger:
// net worth, cash flow, spending by category, with currency normalization
// to the user's base currency via the fx_rates table.
package reporting

import "time"

// NetWorth is the total of all asset accounts minus all liability accounts,
// normalized to the user's base currency.
type NetWorth struct {
	BaseCurrency   string           `json:"base_currency"`
	AsOfDate       time.Time        `json:"as_of_date"`
	TotalAsset     NormalizedAmount `json:"total_asset"`
	TotalLiability NormalizedAmount `json:"total_liability"`
	NetMinor       int64            `json:"net_minor"`
}

// CategorySpend is a category's spending over a period in the user's base
// currency.
type CategorySpend struct {
	AccountID   string `json:"account_id"`
	AccountName string `json:"account_name"`
	Currency    string `json:"currency"`
	SpentMinor  int64  `json:"spent_minor"`
	BaseMinor   int64  `json:"base_minor"`
}

// CashFlow is income and expense totals over a period, normalized to base.
type CashFlow struct {
	BaseCurrency string           `json:"base_currency"`
	PeriodStart  time.Time        `json:"period_start"`
	PeriodEnd    time.Time        `json:"period_end"`
	IncomeMinor  NormalizedAmount `json:"income_minor"`
	ExpenseMinor NormalizedAmount `json:"expense_minor"`
	NetMinor     int64            `json:"net_minor"`
}

// MonthlyPoint is one month of the trailing income/expense trend, in base
// currency.
type MonthlyPoint struct {
	Month        time.Time `json:"month"`
	IncomeMinor  int64     `json:"income_minor"`
	ExpenseMinor int64     `json:"expense_minor"`
	NetMinor     int64     `json:"net_minor"`
}

// NormalizedAmount carries both the raw total and the base-currency equivalent.
type NormalizedAmount struct {
	RawMinor  int64  `json:"raw_minor"`
	Currency  string `json:"currency"`
	BaseMinor int64  `json:"base_minor"`
}
