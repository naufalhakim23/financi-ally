package reporting

import (
	"context"
	"fmt"
	"time"

	"github.com/naufalhakim23/financi-ally/backend/internal/fx"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

// Service generates ledger-scoped reports from the immutable journal. It depends
// on FX rates for currency normalization.
type Service struct {
	repo *Repo
	fx   *fx.Service
}

// NewService wires the reporting service.
func NewService(repo *Repo, fxSvc *fx.Service) *Service {
	return &Service{repo: repo, fx: fxSvc}
}

// NetWorth returns the book's net worth as of today, normalized to base
// currency. Each account's balance is converted to the ledger's base currency
// using the most recent available FX rate.
func (s *Service) NetWorth(ctx context.Context, ledgerID, baseCurrency string) (*NetWorth, error) {
	asOf := time.Now()
	rows, err := s.repo.AccountBalancesByType(ctx, ledgerID, "asset")
	if err != nil {
		return nil, err
	}
	totalAsset := NormalizedAmount{}
	for _, r := range rows {
		base, err := s.normalize(ctx, r.SignedMinor, r.Currency, baseCurrency, asOf)
		if err != nil {
			return nil, err
		}
		totalAsset.RawMinor += r.SignedMinor
		totalAsset.BaseMinor += base
		totalAsset.Currency = baseCurrency
	}

	rows, err = s.repo.AccountBalancesByType(ctx, ledgerID, "liability")
	if err != nil {
		return nil, err
	}
	totalLiability := NormalizedAmount{}
	for _, r := range rows {
		base, err := s.normalize(ctx, r.SignedMinor, r.Currency, baseCurrency, asOf)
		if err != nil {
			return nil, err
		}
		totalLiability.RawMinor += r.SignedMinor
		totalLiability.BaseMinor += base
		totalLiability.Currency = baseCurrency
	}

	return &NetWorth{
		BaseCurrency:   baseCurrency,
		AsOfDate:       asOf,
		TotalAsset:     totalAsset,
		TotalLiability: totalLiability,
		NetMinor:       totalAsset.BaseMinor - totalLiability.BaseMinor,
	}, nil
}

// SpendingByCategory returns total spending per expense account within the
// period, normalized to base currency.
func (s *Service) SpendingByCategory(ctx context.Context, ledgerID, baseCurrency string, start, end time.Time) ([]CategorySpend, error) {
	rows, err := s.repo.SpendingByCategory(ctx, ledgerID, start, end)
	if err != nil {
		return nil, err
	}
	out := make([]CategorySpend, 0, len(rows))
	for _, r := range rows {
		base, err := s.normalize(ctx, r.SpentMinor, r.Currency, baseCurrency, end)
		if err != nil {
			base = 0 // not available → skip normalization, show raw only
		}
		out = append(out, CategorySpend{
			AccountID:   r.AccountID,
			AccountName: r.AccountName,
			Currency:    r.Currency,
			SpentMinor:  r.SpentMinor,
			BaseMinor:   base,
		})
	}
	return out, nil
}

// CashFlow returns income and expense totals for the period, normalized to base.
func (s *Service) CashFlow(ctx context.Context, ledgerID, baseCurrency string, start, end time.Time) (*CashFlow, error) {
	incomes, err := s.repo.TotalsByType(ctx, ledgerID, "income", start, end)
	if err != nil {
		return nil, err
	}
	expenses, err := s.repo.TotalsByType(ctx, ledgerID, "expense", start, end)
	if err != nil {
		return nil, err
	}

	incomeNorm := NormalizedAmount{}
	for _, r := range incomes {
		base, err := s.normalize(ctx, r.AmountMinor, r.Currency, baseCurrency, end)
		if err != nil {
			return nil, err
		}
		incomeNorm.RawMinor += r.AmountMinor
		incomeNorm.BaseMinor += base
		incomeNorm.Currency = baseCurrency
	}

	expenseNorm := NormalizedAmount{}
	for _, r := range expenses {
		base, err := s.normalize(ctx, r.AmountMinor, r.Currency, baseCurrency, end)
		if err != nil {
			return nil, err
		}
		expenseNorm.RawMinor += r.AmountMinor
		expenseNorm.BaseMinor += base
		expenseNorm.Currency = baseCurrency
	}

	return &CashFlow{
		BaseCurrency: baseCurrency,
		PeriodStart:  start,
		PeriodEnd:    end,
		IncomeMinor:  incomeNorm,
		ExpenseMinor: expenseNorm,
		NetMinor:     incomeNorm.BaseMinor - expenseNorm.BaseMinor,
	}, nil
}

// MonthlySeries returns the trailing `months` calendar months ending with the
// current one, oldest first, each normalized to base currency.
//
// ponytail: this reuses CashFlow per month (2 queries each) instead of one
// grouped date_trunc rollup. At the 1–24 month ceiling that is at most 48 small
// indexed queries on a single ledger, and it inherits CashFlow's tested
// FX normalization. Swap in a single grouped query if the reports screen ever
// gets hot.
func (s *Service) MonthlySeries(ctx context.Context, ledgerID, baseCurrency string, months int) ([]MonthlyPoint, error) {
	windows := monthWindows(time.Now(), months)
	out := make([]MonthlyPoint, 0, len(windows))
	for _, w := range windows {
		cf, err := s.CashFlow(ctx, ledgerID, baseCurrency, w.start, w.end)
		if err != nil {
			return nil, err
		}
		out = append(out, MonthlyPoint{
			Month:        w.start,
			IncomeMinor:  cf.IncomeMinor.BaseMinor,
			ExpenseMinor: cf.ExpenseMinor.BaseMinor,
			NetMinor:     cf.NetMinor,
		})
	}
	return out, nil
}

type monthWindow struct{ start, end time.Time }

// monthWindows returns `months` half-open [start, end) calendar windows ending
// with the month containing `now`, oldest first. Boundaries are UTC so a point's
// label matches txn_date (a DATE) regardless of the server's zone.
func monthWindows(now time.Time, months int) []monthWindow {
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	out := make([]monthWindow, 0, months)
	for i := months - 1; i >= 0; i-- {
		start := current.AddDate(0, -i, 0)
		out = append(out, monthWindow{start: start, end: start.AddDate(0, 1, 0)})
	}
	return out
}

// normalize converts an amount from its source currency to the target currency
// as of a given date using the FX service.
func (s *Service) normalize(ctx context.Context, minor int64, from, to string, asOf time.Time) (int64, error) {
	if from == to || minor == 0 {
		return minor, nil
	}
	rate, err := s.fx.AtOrBefore(ctx, from, to, asOf)
	if err != nil {
		return 0, fmt.Errorf("normalize %s→%s: %w", from, to, err)
	}
	return money.Convert(minor, from, to, rate.Rate)
}
