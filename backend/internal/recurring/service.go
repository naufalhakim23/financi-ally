package recurring

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/teambition/rrule-go"

	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

var (
	// ErrInvalidInput: malformed rrule or template at the trust boundary.
	ErrInvalidInput = errors.New("invalid input")
	// ErrUnbalancedTemplate: the template's debits ≠ credits. Caught at create
	// time so a rule can't be saved that would fail every scheduler tick.
	ErrUnbalancedTemplate = errors.New("recurring template is not balanced")
	// ErrAccountNotUsable: a template line references an account that is missing,
	// archived, or in a different currency than the template.
	ErrAccountNotUsable = errors.New("template references an unusable account")
)

// maxCatchUp bounds how many missed occurrences one sweep will post. A rule
// stalled by downtime catches up fully in a single tick rather than one
// occurrence per tick; the cap stops a decade-old backdated rule from posting
// thousands of entries in one go.
const maxCatchUp = 366

// Service orchestrates recurring rules: CRUD and the scheduler that
// materializes due rules into posted ledger entries.
//
// All scheduling is date-granular and evaluated in loc — occurrence dates are
// what a user means by "the 1st of the month", and a timestamp would make the
// boundary depend on the server's clock zone.
type Service struct {
	repo *Repo
	led  *ledger.Service
	loc  *time.Location
}

// NewService wires the service. loc is the timezone the scheduler resolves
// calendar dates in; nil falls back to UTC.
func NewService(repo *Repo, led *ledger.Service, loc *time.Location) *Service {
	if loc == nil {
		loc = time.UTC
	}
	return &Service{repo: repo, led: led, loc: loc}
}

// Create validates and persists a recurring rule. id is the client id (sync) or
// empty → server uuid (REST). next_run is computed before the insert so the
// rule is never stored without its first occurrence.
func (s *Service) Create(ctx context.Context, userID, id, rruleStr string, tmpl Template, active bool) (*RecurringRule, error) {
	if id == "" {
		id = uuid.NewString()
	}
	r, tmpl, err := s.validate(ctx, userID, rruleStr, tmpl)
	if err != nil {
		return nil, err
	}

	// First occurrence is the first one on or after today — a daily rule created
	// today runs today, not tomorrow.
	nextRun := s.occurrenceAfter(r, s.today().Add(-time.Nanosecond))
	if nextRun == nil {
		active = false // rule has no future occurrences
	}

	tmplBytes, err := MarshalTemplate(tmpl)
	if err != nil {
		return nil, ErrInvalidInput
	}
	return s.repo.Create(ctx, id, userID, rruleStr, tmplBytes, nextRun, active)
}

// List returns a user's non-deleted recurring rules.
func (s *Service) List(ctx context.Context, userID string) ([]*RecurringRule, error) {
	return s.repo.List(ctx, userID)
}

// Get returns one rule scoped to the user.
func (s *Service) Get(ctx context.Context, userID, id string) (*RecurringRule, error) {
	if id == "" {
		return nil, ErrRuleNotFound
	}
	return s.repo.Get(ctx, userID, id)
}

// Update changes a rule's definition and recomputes its next occurrence from
// whichever is later: today, or the day after the last one already posted (so
// editing a rule never re-posts an occurrence that already exists).
func (s *Service) Update(ctx context.Context, userID, id, rruleStr string, tmpl Template, active bool) (*RecurringRule, error) {
	if id == "" {
		return nil, ErrRuleNotFound
	}
	existing, err := s.repo.Get(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	r, tmpl, err := s.validate(ctx, userID, rruleStr, tmpl)
	if err != nil {
		return nil, err
	}

	after := s.today().Add(-time.Nanosecond)
	if existing.LastRun != nil {
		if endOfLast := s.endOfDay(*existing.LastRun); endOfLast.After(after) {
			after = endOfLast
		}
	}
	nextRun := s.occurrenceAfter(r, after)
	if nextRun == nil {
		active = false
	}

	tmplBytes, err := MarshalTemplate(tmpl)
	if err != nil {
		return nil, ErrInvalidInput
	}
	return s.repo.Update(ctx, userID, id, rruleStr, tmplBytes, nextRun, active)
}

// Delete soft-deletes a recurring rule (idempotent).
func (s *Service) Delete(ctx context.Context, userID, id string) error {
	if id == "" {
		return ErrRuleNotFound
	}
	return s.repo.Delete(ctx, userID, id)
}

// MaterializeDue posts entries for every user's due rules. Used by the
// background scheduler.
func (s *Service) MaterializeDue(ctx context.Context) (int, error) {
	return s.materializeDue(ctx, "")
}

// MaterializeDueForUser posts entries for one user's due rules. Used by the
// manual trigger endpoint, which must not touch other tenants' ledgers.
func (s *Service) MaterializeDueForUser(ctx context.Context, userID string) (int, error) {
	if userID == "" {
		return 0, ErrInvalidInput
	}
	return s.materializeDue(ctx, userID)
}

// materializeDue posts every occurrence that is due on or before today. A rule
// whose posting fails records the error and is skipped — one bad rule must not
// stall the sweep for everyone else.
func (s *Service) materializeDue(ctx context.Context, userID string) (int, error) {
	today := s.today()
	due, err := s.repo.DueRules(ctx, userID, today)
	if err != nil {
		return 0, err
	}

	var count int
	for _, rule := range due {
		n, err := s.materializeRule(ctx, rule, today)
		count += n
		if err != nil {
			slog.Error("materialize recurring rule", "rule_id", rule.ID, "err", err)
			if rerr := s.repo.RecordError(ctx, rule.ID, err.Error()); rerr != nil {
				slog.Error("record recurring error", "rule_id", rule.ID, "err", rerr)
			}
		}
	}
	return count, nil
}

// materializeRule posts each occurrence the rule owes up to today, advancing it
// after every one. Returns how many entries were newly posted.
func (s *Service) materializeRule(ctx context.Context, rule *RecurringRule, today time.Time) (int, error) {
	r, err := s.parseRule(rule.RRule)
	if err != nil {
		return 0, ErrInvalidInput
	}

	var posted int
	occurrence := rule.NextRun
	for i := 0; occurrence != nil && !occurrence.After(today) && i < maxCatchUp; i++ {
		newlyPosted, err := s.postOccurrence(ctx, rule, *occurrence)
		if err != nil {
			return posted, err
		}
		if newlyPosted {
			posted++
		}

		next := s.occurrenceAfter(r, s.endOfDay(*occurrence))
		if err := s.repo.Advance(ctx, rule.ID, next, occurrence, next != nil); err != nil {
			return posted, err
		}
		occurrence = next
	}
	return posted, nil
}

// postOccurrence posts the rule's template for one date. Reports false (without
// an error) when the occurrence was already posted — the DB's partial unique
// index on (recurring_rule_id, txn_date) is what makes a retry, a concurrent
// scheduler replica, or a double tick safe.
func (s *Service) postOccurrence(ctx context.Context, rule *RecurringRule, txnDate time.Time) (bool, error) {
	tmpl := rule.Template
	in := ledger.EntryInput{
		Currency:        tmpl.Currency,
		Memo:            tmpl.Memo,
		Source:          "recurring",
		RecurringRuleID: &rule.ID,
		TxnDate:         txnDate,
	}
	for _, ln := range tmpl.Lines {
		in.Lines = append(in.Lines, ledger.LineInput{
			AccountID:   ln.AccountID,
			DC:          ledger.DC(ln.DC),
			AmountMinor: ln.AmountMinor,
			Currency:    ln.Currency,
		})
	}

	if _, err := s.led.Post(ctx, rule.UserID, in); err != nil {
		if errors.Is(err, ledger.ErrDuplicateEntry) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// validate checks the rrule, the template's shape and balance, and that every
// referenced account is usable — all at write time, so a rule that could never
// post is rejected with a 400 instead of failing silently on every tick.
func (s *Service) validate(ctx context.Context, userID, rruleStr string, tmpl Template) (*rrule.RRule, Template, error) {
	r, err := s.parseRule(rruleStr)
	if err != nil {
		return nil, tmpl, ErrInvalidInput
	}

	tmpl.Currency = strings.ToUpper(strings.TrimSpace(tmpl.Currency))
	if !money.IsAlpha3(tmpl.Currency) {
		return nil, tmpl, ErrInvalidInput
	}
	if len(tmpl.Lines) < 2 {
		return nil, tmpl, ErrInvalidInput
	}

	var debit, credit int64
	for i := range tmpl.Lines {
		ln := &tmpl.Lines[i]
		if ln.AccountID == "" || ln.AmountMinor <= 0 {
			return nil, tmpl, ErrInvalidInput
		}
		if ln.DC != string(ledger.DCDebit) && ln.DC != string(ledger.DCCredit) {
			return nil, tmpl, ErrInvalidInput
		}
		// ponytail: recurring is single-currency; a cross-currency rule would
		// need a rate resolved per occurrence. Reject early rather than post a
		// rule that the ledger will refuse anyway.
		ln.Currency = strings.ToUpper(strings.TrimSpace(ln.Currency))
		if ln.Currency != "" && ln.Currency != tmpl.Currency {
			return nil, tmpl, ErrInvalidInput
		}
		ln.Currency = ""
		if ln.DC == string(ledger.DCDebit) {
			debit += ln.AmountMinor
		} else {
			credit += ln.AmountMinor
		}
	}
	if debit != credit {
		return nil, tmpl, ErrUnbalancedTemplate
	}

	for _, id := range uniqueAccountIDs(tmpl.Lines) {
		acct, err := s.led.GetAccount(ctx, userID, id)
		if err != nil {
			if errors.Is(err, ledger.ErrAccountNotFound) {
				return nil, tmpl, ErrAccountNotUsable
			}
			return nil, tmpl, err
		}
		if acct.Archived || acct.Currency != tmpl.Currency {
			return nil, tmpl, ErrAccountNotUsable
		}
	}
	return r, tmpl, nil
}

// parseRule parses an RRULE and pins DTSTART to midnight in the scheduler's
// timezone. Without this, DTSTART defaults to the creation *time of day*, and
// "the next occurrence after date D" resolves back to D — which made a rule
// re-post the same entry on every tick instead of advancing.
func (s *Service) parseRule(rruleStr string) (*rrule.RRule, error) {
	if strings.TrimSpace(rruleStr) == "" {
		return nil, ErrInvalidInput
	}
	opt, err := rrule.StrToROption(rruleStr)
	if err != nil {
		return nil, err
	}
	start := opt.Dtstart
	if start.IsZero() {
		start = time.Now()
	}
	opt.Dtstart = s.startOfDay(start)
	return rrule.NewRRule(*opt)
}

// occurrenceAfter returns the first occurrence strictly after t, as a date in
// the scheduler's timezone; nil when the rule is exhausted.
func (s *Service) occurrenceAfter(r *rrule.RRule, t time.Time) *time.Time {
	next := r.After(t, false)
	if next.IsZero() {
		return nil
	}
	d := s.startOfDay(next)
	return &d
}

func (s *Service) today() time.Time { return s.startOfDay(time.Now()) }

func (s *Service) startOfDay(t time.Time) time.Time {
	t = t.In(s.loc)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, s.loc)
}

// endOfDay is the last instant of t's day — used as an exclusive lower bound so
// "next occurrence" always lands on a later date, whatever time-of-day
// components the rule carries.
func (s *Service) endOfDay(t time.Time) time.Time {
	return s.startOfDay(t).Add(24*time.Hour - time.Nanosecond)
}

func uniqueAccountIDs(lines []TemplateLine) []string {
	seen := make(map[string]struct{}, len(lines))
	out := make([]string, 0, len(lines))
	for _, ln := range lines {
		if _, ok := seen[ln.AccountID]; ok {
			continue
		}
		seen[ln.AccountID] = struct{}{}
		out = append(out, ln.AccountID)
	}
	return out
}
