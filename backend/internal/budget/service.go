package budget

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
)

// Service-level sentinels.
var (
	// ErrInvalidInput: bad period, target, or the referenced account isn't an
	// owned expense account in the budget's currency.
	ErrInvalidInput = errors.New("invalid input")
)

// Service orchestrates budgets: set/list/update targets and compute spent.
// It depends on the ledger service only to validate that a budget targets an
// owned expense account in the matching currency.
type Service struct {
	repo *Repo
	led  *ledger.Service
}

// NewService wires the budget service with its repo and the ledger service.
func NewService(repo *Repo, led *ledger.Service) *Service { return &Service{repo: repo, led: led} }

// Set creates or updates a budget for (account, month). id is the client id
// (sync) or empty → server uuid (REST). The account must be an owned expense
// account whose currency matches; the period must be month-start.
func (s *Service) Set(ctx context.Context, ledgerID, id, accountID string, period time.Time, target int64) (*Budget, error) {
	if accountID == "" {
		return nil, ErrInvalidInput
	}
	if target < 0 {
		return nil, ErrInvalidInput
	}
	if id == "" {
		id = uuid.NewString()
	}
	// Month-start: truncate to first-of-month so "2026-07-15" is rejected, not
	// silently rounded — a budget for the wrong month is a silent money bug.
	start := time.Date(period.Year(), period.Month(), 1, 0, 0, 0, 0, period.Location())
	if !period.Equal(start) {
		return nil, ErrInvalidInput
	}

	a, err := s.led.GetAccount(ctx, ledgerID, accountID)
	if err != nil {
		return nil, ErrInvalidInput
	}
	if a.Type != ledger.AccountTypeExpense {
		return nil, ErrInvalidInput
	}
	return s.repo.Upsert(ctx, id, ledgerID, accountID, period, a.Currency, target)
}

// List returns a month's budgets with live spent totals.
func (s *Service) List(ctx context.Context, ledgerID string, period time.Time) ([]*BudgetWithSpent, error) {
	bs, err := s.repo.List(ctx, ledgerID, period)
	if err != nil {
		return nil, err
	}
	end := period.AddDate(0, 1, 0) // exclusive month end
	out := make([]*BudgetWithSpent, 0, len(bs))
	for _, b := range bs {
		spent, err := s.repo.SpentForAccount(ctx, ledgerID, b.AccountID, period, end)
		if err != nil {
			return nil, err
		}
		out = append(out, &BudgetWithSpent{Budget: *b, SpentMinor: spent})
	}
	return out, nil
}

// UpdateTarget changes a budget's target. Validates ownership via Get.
func (s *Service) UpdateTarget(ctx context.Context, ledgerID, id string, target int64) (*Budget, error) {
	if target < 0 {
		return nil, ErrInvalidInput
	}
	if id == "" {
		return nil, ErrBudgetNotFound
	}
	return s.repo.UpdateTarget(ctx, ledgerID, id, target)
}

// Delete removes a budget (idempotent).
func (s *Service) Delete(ctx context.Context, ledgerID, id string) error {
	if id == "" {
		return ErrBudgetNotFound
	}
	return s.repo.Delete(ctx, ledgerID, id)
}
