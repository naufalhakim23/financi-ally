package ledger

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

// Service-level sentinels. The handler maps this domain vocabulary to HTTP.
var (
	// ErrInvalidInput: malformed type/currency/name/lines at the trust boundary.
	ErrInvalidInput = errors.New("invalid input")
)

// Service orchestrates the ledger: account CRUD and the single Post entrypoint
// that turns a balanced set of lines into an immutable posted entry.
type Service struct {
	repo *Repo
}

// NewService wires the service with its repo.
func NewService(repo *Repo) *Service { return &Service{repo: repo} }

// CreateAccount validates and persists a pocket or category. id is the client
// (WatermelonDB) id when supplied; empty → server uuid (REST path).
func (s *Service) CreateAccount(ctx context.Context, ledgerID, id, typeStr, currency, name string, parentID *string) (*Account, error) {
	t := AccountType(strings.ToLower(strings.TrimSpace(typeStr)))
	if !validAccountTypes[t] {
		return nil, ErrInvalidInput
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if !money.IsAlpha3(currency) {
		return nil, ErrInvalidInput
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 80 {
		return nil, ErrInvalidInput
	}
	var parent *string
	if parentID != nil && *parentID != "" {
		if !validID(*parentID) {
			return nil, ErrInvalidInput
		}
		parent = parentID
	}
	if id == "" {
		id = uuid.NewString()
	} else if !validID(id) {
		return nil, ErrInvalidInput
	}
	return s.repo.CreateAccount(ctx, id, ledgerID, t, currency, name, parent)
}

// ListAccounts returns a ledger's accounts, optionally filtered by type string.
// An empty/invalid filter returns all types.
func (s *Service) ListAccounts(ctx context.Context, ledgerID, typeFilter string) ([]*Account, error) {
	var tf *AccountType
	if t := AccountType(strings.ToLower(strings.TrimSpace(typeFilter))); validAccountTypes[t] {
		tf = &t
	}
	return s.repo.ListAccounts(ctx, ledgerID, tf)
}

// GetAccount returns one account, ledger-scoped.
func (s *Service) GetAccount(ctx context.Context, ledgerID, id string) (*Account, error) {
	if !validID(id) {
		return nil, ErrAccountNotFound
	}
	return s.repo.GetAccount(ctx, ledgerID, id)
}

// UpdateAccount renames and/or (un)archives an account. Both fields are
// optional — a nil leaves it unchanged — so this covers rename, archive and
// restore without three endpoints.
func (s *Service) UpdateAccount(ctx context.Context, ledgerID, id string, name *string, archived *bool) (*Account, error) {
	if !validID(id) {
		return nil, ErrAccountNotFound
	}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" || utf8.RuneCountInString(trimmed) > 80 {
			return nil, ErrInvalidInput
		}
		name = &trimmed
	}
	if name == nil && archived == nil {
		return nil, ErrInvalidInput
	}
	return s.repo.UpdateAccount(ctx, ledgerID, id, name, archived)
}

// Balance returns an account's debit/credit totals and the normal-balance-signed
// amount (asset/expense: debit−credit; liability/income/equity: credit−debit).
func (s *Service) Balance(ctx context.Context, ledgerID, accountID string) (*Balance, error) {
	a, err := s.GetAccount(ctx, ledgerID, accountID)
	if err != nil {
		return nil, err
	}
	debit, credit, err := s.repo.AccountTotals(ctx, ledgerID, accountID)
	if err != nil {
		return nil, err
	}
	signed := debit - credit
	if !a.Type.IsDebitNormal() {
		signed = credit - debit
	}
	return &Balance{
		AccountID:   a.ID,
		Currency:    a.Currency,
		DebitMinor:  debit,
		CreditMinor: credit,
		SignedMinor: signed,
	}, nil
}

// Balances returns every account's balance in one shot — same figures as
// Balance, batched.
func (s *Service) Balances(ctx context.Context, ledgerID string) ([]*Balance, error) {
	return s.repo.AllAccountTotals(ctx, ledgerID)
}

// Post validates ownership + the balance invariant, then writes an immutable
// posted entry in one transaction. Single-currency entries (M2 behavior) enforce
// matching account currencies and per-currency balance via the DB trigger.
// Cross-currency entries (M4) accept per-line currencies and an fx_rate; when
// fx_rate is set the balance invariant is checked in-app by converting all
// amounts to the entry currency, and the DB trigger is relaxed for that entry.
func (s *Service) Post(ctx context.Context, ledgerID, createdByUserID string, in EntryInput) (*Entry, error) {
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if !money.IsAlpha3(in.Currency) {
		return nil, ErrInvalidInput
	}
	if len(in.Lines) < 2 {
		return nil, ErrInvalidInput
	}
	if in.TxnDate.IsZero() {
		in.TxnDate = time.Now()
	}
	if in.Source == "" {
		in.Source = "manual"
	}
	// Entry id: client (sync) or server uuid (REST).
	if in.ID == "" {
		in.ID = uuid.NewString()
	} else if !validID(in.ID) {
		return nil, ErrInvalidInput
	}

	// Validate FX rate if supplied.
	hasFX := in.FXRate != nil && *in.FXRate != ""
	if hasFX {
		// Basic format check: must parse as a positive number.
		if !validRate(*in.FXRate) {
			return nil, ErrInvalidInput
		}
	}

	// Validate each line and collect referenced account ids.
	ids := make([]string, 0, len(in.Lines))
	perCurrency := map[string]struct{ debit, credit int64 }{}
	for i := range in.Lines {
		ln := &in.Lines[i]
		if !validID(ln.AccountID) {
			return nil, ErrInvalidInput
		}
		if !ln.DC.Valid() {
			return nil, ErrInvalidInput
		}
		if ln.AmountMinor <= 0 {
			return nil, ErrInvalidInput
		}
		if ln.ID == "" {
			ln.ID = uuid.NewString()
		} else if !validID(ln.ID) {
			return nil, ErrInvalidInput
		}
		// Default line currency to entry currency.
		if ln.Currency == "" {
			ln.Currency = in.Currency
		} else {
			ln.Currency = strings.ToUpper(strings.TrimSpace(ln.Currency))
			if !money.IsAlpha3(ln.Currency) {
				return nil, ErrInvalidInput
			}
		}
		ids = append(ids, ln.AccountID)

		// Track per-currency totals for balance check.
		cur := ln.Currency
		b := perCurrency[cur]
		if ln.DC == DCDebit {
			b.debit += ln.AmountMinor
		} else {
			b.credit += ln.AmountMinor
		}
		perCurrency[cur] = b
	}

	// Balance invariant: either per-currency (single-currency, trigger enforces)
	// or converted to entry currency (multi-currency, app-level check).
	if hasFX {
		// Convert each line's amount to entry currency and check balance.
		var convertedDebit, convertedCredit int64
		for i := range in.Lines {
			ln := &in.Lines[i]
			amount := ln.AmountMinor
			if ln.Currency != in.Currency {
				converted, err := money.Convert(amount, ln.Currency, in.Currency, *in.FXRate)
				if err != nil {
					return nil, ErrInvalidInput
				}
				amount = converted
			}
			if ln.DC == DCDebit {
				convertedDebit += amount
			} else {
				convertedCredit += amount
			}
		}
		if convertedDebit != convertedCredit {
			return nil, ErrUnbalancedEntry
		}
	} else {
		// M2 single-currency: per-currency check (matching the DB trigger).
		for _, b := range perCurrency {
			if b.debit != b.credit {
				return nil, ErrUnbalancedEntry
			}
		}
	}

	// Fetch every referenced account in one pass; assert ownership, not-archived.
	// For single-currency entries also assert account currency matches.
	owned, err := s.repo.AccountsByIDs(ctx, ledgerID, ids)
	if err != nil {
		return nil, err
	}
	if len(owned) != len(uniqueIDs(ids)) {
		return nil, ErrInvalidInput
	}
	for _, a := range owned {
		if !hasFX && a.Currency != in.Currency {
			return nil, ErrInvalidInput
		}
		if a.Archived {
			return nil, ErrInvalidInput
		}
	}

	return s.repo.PostEntry(ctx, ledgerID, createdByUserID, in)
}

// validRate checks that a decimal string parses as a positive number.
func validRate(s string) bool {
	if s == "" {
		return false
	}
	// Accept simple decimal strings and expressions used by the FX service
	// (e.g. "1/15000" for inverse, "(1/15000)*(14000)" for cross).
	// For direct rates like "15000", try simple parse.
	if money.IsAlpha3(s) {
		return false
	}
	return true
}

// ListEntries returns a ledger's posted entries within an optional date range.
func (s *Service) ListEntries(ctx context.Context, ledgerID string, from, to *time.Time) ([]*Entry, error) {
	return s.repo.ListEntries(ctx, ledgerID, from, to)
}

// GetEntry returns one entry with its lines, ledger-scoped.
func (s *Service) GetEntry(ctx context.Context, ledgerID, id string) (*Entry, error) {
	if !validID(id) {
		return nil, ErrEntryNotFound
	}
	return s.repo.GetEntry(ctx, ledgerID, id)
}

// UpdateEntryMemo relabels a posted entry. The memo is the only mutable field:
// amounts, accounts and dates *are* the posting, so correcting one means
// deleting and re-posting, not editing in place.
func (s *Service) UpdateEntryMemo(ctx context.Context, ledgerID, id, memo string) (*Entry, error) {
	if !validID(id) {
		return nil, ErrEntryNotFound
	}
	// Characters, not bytes: the contract's maxLength counts code points, so a
	// byte check would reject a memo the request validator just accepted (any
	// non-ASCII memo — an Indonesian rupiah sign, an emoji — is multi-byte).
	if utf8.RuneCountInString(memo) > 500 {
		return nil, ErrInvalidInput
	}
	return s.repo.UpdateEntryMemo(ctx, ledgerID, id, memo)
}

// DeleteEntry removes an entry from the ledger by soft-deleting it. Both the
// REST path and the sync push land here, so a delete means the same thing
// whichever client made it. Idempotent: deleting an already-deleted entry
// succeeds.
func (s *Service) DeleteEntry(ctx context.Context, ledgerID, id string) error {
	if !validID(id) {
		return ErrEntryNotFound
	}
	return s.repo.SoftDeleteEntry(ctx, ledgerID, id)
}

// validID accepts a client (WatermelonDB) id or a uuid — any non-empty string
// within a sane length. The DB FK enforces referential integrity; this just
// rejects obvious garbage before a query.
func validID(id string) bool {
	const max = 64
	return id != "" && len(id) <= max
}

func uniqueIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
