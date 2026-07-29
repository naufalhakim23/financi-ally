package reporting

import (
	"context"
	"fmt"
	"time"

	"github.com/naufalhakim23/financi-ally/backend/internal/fx"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

// Service generates user-scoped reports from the immutable ledger. It depends
// on FX rates for currency normalization.
type Service struct {
	repo *Repo
	fx   *fx.Service
}

// NewService wires the reporting service.
func NewService(repo *Repo, fxSvc *fx.Service) *Service {
	return &Service{repo: repo, fx: fxSvc}
}

// NetWorth returns the user's net worth as of today, normalized to base
// currency. Each account's balance is converted to the user's base currency
// using the most recent available FX rate.
func (s *Service) NetWorth(ctx context.Context, userID, baseCurrency string) (*NetWorth, error) {
	asOf := time.Now()
	rows, err := s.repo.AccountBalancesByType(ctx, userID, "asset")
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

	rows, err = s.repo.AccountBalancesByType(ctx, userID, "liability")
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
func (s *Service) SpendingByCategory(ctx context.Context, userID, baseCurrency string, start, end time.Time) ([]CategorySpend, error) {
	rows, err := s.repo.SpendingByCategory(ctx, userID, start, end)
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
func (s *Service) CashFlow(ctx context.Context, userID, baseCurrency string, start, end time.Time) (*CashFlow, error) {
	incomes, err := s.repo.TotalsByType(ctx, userID, "income", start, end)
	if err != nil {
		return nil, err
	}
	expenses, err := s.repo.TotalsByType(ctx, userID, "expense", start, end)
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
