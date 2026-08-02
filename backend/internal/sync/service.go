package sync

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/naufalhakim23/financi-ally/backend/internal/budget"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
	"github.com/naufalhakim23/financi-ally/backend/internal/recurring"
)

// Service orchestrates pull/push against the ledger. Pull is read-only query
// work; push reuses ledger.Post (for the balance invariant + ownership) and
// budget.Set, plus a direct account upsert, so pushed records can't bypass the
// same validation the REST path enforces.
type Service struct {
	repo *Repo
	led  *ledger.Service
	bud  *budget.Service
	rec  *recurring.Service
	att  AttachmentLinker
}

// AttachmentLinker files a scanned receipt image against the entry it produced.
// A narrow interface rather than the scan service itself: sync needs exactly one
// verb from it, and stating that keeps the dependency legible.
type AttachmentLinker interface {
	Link(ctx context.Context, ledgerID, attachmentID, entryID string) error
}

// NewService wires the sync service. att may be nil, in which case pushed
// attachment ids are ignored.
func NewService(repo *Repo, led *ledger.Service, bud *budget.Service, rec *recurring.Service, att AttachmentLinker) *Service {
	return &Service{repo: repo, led: led, bud: bud, rec: rec, att: att}
}

// Pull returns all changes since the client's watermark (ms epoch). The
// watermark 0 means "everything" (first sync).
func (s *Service) Pull(ctx context.Context, ledgerID string, lastPulledAtMs int64) (PullResponse, error) {
	asOf := time.Now()                      // snapshot bound so the next pull isn't racy
	since := time.UnixMilli(lastPulledAtMs) // zero-time if 0 → matches all "created > since"
	changes := ChangeSet{}
	for _, table := range syncedTables {
		created, err := s.repo.PullCreated(ctx, ledgerID, table, since, asOf)
		if err != nil {
			return PullResponse{}, err
		}
		updated, err := s.repo.PullUpdated(ctx, ledgerID, table, since, asOf)
		if err != nil {
			return PullResponse{}, err
		}
		deleted, err := s.repo.PullDeleted(ctx, ledgerID, table, since, asOf)
		if err != nil {
			return PullResponse{}, err
		}
		if len(created) > 0 || len(updated) > 0 || len(deleted) > 0 {
			changes[table] = TableChanges{Created: created, Updated: updated, Deleted: deleted}
		}
	}
	return PullResponse{Changes: changes, Timestamp: asOf.UnixMilli()}, nil
}

// Push applies client changes table by table in dependency order. Invalid
// records (unbalanced entry, bad account, etc.) are reported in Errors keyed by
// client id; the rest apply.
func (s *Service) Push(ctx context.Context, ledgerID, userID string, req PushRequest) (PushResponse, error) {
	errs := map[string]string{}
	changes := req.Changes

	// accounts first — entries reference them.
	if tc, ok := changes["accounts"]; ok {
		for _, rec := range append(tc.Created, tc.Updated...) {
			id := strID(rec, "id")
			if err := s.pushAccount(ctx, ledgerID, id, rec); err != nil {
				errs[id] = err.Error()
			}
		}
		for _, id := range tc.Deleted {
			if err := s.repo.SoftDelete(ctx, "accounts", ledgerID, id); err != nil {
				errs[id] = err.Error()
			}
		}
	}

	// budgets — independent of entries.
	if tc, ok := changes["budgets"]; ok {
		for _, rec := range append(tc.Created, tc.Updated...) {
			id := strID(rec, "id")
			if err := s.pushBudget(ctx, ledgerID, id, rec); err != nil {
				errs[id] = err.Error()
			}
		}
		for _, id := range tc.Deleted {
			if err := s.repo.SoftDelete(ctx, "budgets", ledgerID, id); err != nil {
				errs[id] = err.Error()
			}
		}
	}

	// recurring_rules — the client can define a rule offline; the server owns
	// scheduling, so pushing a rule only stores the definition.
	if tc, ok := changes["recurring_rules"]; ok {
		for _, rec := range append(tc.Created, tc.Updated...) {
			id := strID(rec, "id")
			if err := s.pushRecurring(ctx, ledgerID, id, rec); err != nil {
				errs[id] = err.Error()
			}
		}
		for _, id := range tc.Deleted {
			if err := s.rec.Delete(ctx, ledgerID, id); err != nil {
				errs[id] = err.Error()
			}
		}
	}

	// entries — assemble each entry's lines from the journal_lines delta and
	// Post through the ledger so the balance invariant + ownership apply.
	linesByEntry := indexLinesByEntry(changes["journal_lines"])
	if tc, ok := changes["entries"]; ok {
		for _, rec := range tc.Created {
			id := strID(rec, "id")
			if err := s.pushEntry(ctx, ledgerID, userID, id, rec, linesByEntry[id]); err != nil {
				errs[id] = err.Error()
			}
		}
		// entries are immutable once posted; client "updated" on a posted entry
		// is ignored (corrections are reversing entries). Don't error — WMB may
		// resend an updated record after a local field change we don't model.
	}

	if len(errs) == 0 {
		return PushResponse{}, nil
	}
	return PushResponse{Errors: errs}, nil
}

// pushAccount validates and upserts one account record.
func (s *Service) pushAccount(ctx context.Context, ledgerID, id string, rec map[string]any) error {
	if id == "" {
		return fmt.Errorf("missing id")
	}
	typeStr, _ := rec["type"].(string)
	t := ledger.AccountType(strings.ToLower(strings.TrimSpace(typeStr)))
	if t != ledger.AccountTypeAsset && t != ledger.AccountTypeLiability &&
		t != ledger.AccountTypeIncome && t != ledger.AccountTypeExpense && t != ledger.AccountTypeEquity {
		return fmt.Errorf("invalid account type")
	}
	currency := strings.ToUpper(strings.TrimSpace(strOr(rec, "currency")))
	if !money.IsAlpha3(currency) {
		return fmt.Errorf("invalid currency")
	}
	name := strings.TrimSpace(strOr(rec, "name"))
	if name == "" {
		return fmt.Errorf("missing name")
	}
	var parentID *string
	if p := strOr(rec, "parent_id"); p != "" {
		parentID = &p
	}
	archived, _ := rec["archived"].(bool)
	return s.repo.UpsertAccount(ctx, id, ledgerID, string(t), currency, name, parentID, archived)
}

// pushBudget validates and upserts one budget record via the budget service
// (which checks the account is an owned expense account).
func (s *Service) pushBudget(ctx context.Context, ledgerID, id string, rec map[string]any) error {
	if id == "" {
		return fmt.Errorf("missing id")
	}
	accountID := strOr(rec, "account_id")
	target, _ := toInt64(rec["target_minor"])
	period := toTime(rec["period_month"])
	if _, err := s.bud.Set(ctx, ledgerID, id, accountID, period, target); err != nil {
		return err
	}
	return nil
}

// pushRecurring stores one offline-authored recurring rule through the
// recurring service, so the same rrule/template/account validation applies as on
// the REST path. Create-vs-update is decided by what the server already has:
// WatermelonDB replays a record as "created" after a failed push, and the client
// can also edit a rule the server already knows.
func (s *Service) pushRecurring(ctx context.Context, ledgerID, id string, rec map[string]any) error {
	if id == "" {
		return fmt.Errorf("missing id")
	}
	tmpl, err := recurring.UnmarshalTemplate([]byte(strOr(rec, "template")))
	if err != nil {
		return fmt.Errorf("invalid template: %w", err)
	}
	rrule := strOr(rec, "rrule")
	active := toBoolOr(rec["active"], true)

	if _, err := s.rec.Get(ctx, ledgerID, id); err == nil {
		_, err = s.rec.Update(ctx, ledgerID, id, rrule, tmpl, active)
		return err
	} else if !errors.Is(err, recurring.ErrRuleNotFound) {
		return err
	}
	_, err = s.rec.Create(ctx, ledgerID, id, rrule, tmpl, active)
	return err
}

// pushEntry assembles an entry + its lines and Posts through the ledger, so the
// balance invariant, account ownership, and currency match all apply identically
// to the REST path.
func (s *Service) pushEntry(ctx context.Context, ledgerID, userID, id string, rec map[string]any, lines []map[string]any) error {
	if id == "" {
		return fmt.Errorf("missing id")
	}
	cur := strings.ToUpper(strings.TrimSpace(strOr(rec, "currency")))
	in := ledger.EntryInput{
		ID:       id,
		Currency: cur,
		Memo:     strOr(rec, "memo"),
		Source:   ledger.ClientSource(strOr(rec, "source")),
		TxnDate:  toTime(rec["txn_date"]),
	}
	if fx := strOr(rec, "fx_rate"); fx != "" {
		in.FXRate = &fx
	}
	for _, ln := range lines {
		line := ledger.LineInput{
			ID:          strID(ln, "id"),
			AccountID:   strOr(ln, "account_id"),
			DC:          ledger.DC(strOr(ln, "dc")),
			AmountMinor: toInt64Or(ln["amount_minor"], 0),
		}
		if lc := strOr(ln, "currency"); lc != "" {
			line.Currency = strings.ToUpper(strings.TrimSpace(lc))
		}
		in.Lines = append(in.Lines, line)
	}
	if _, err := s.led.Post(ctx, ledgerID, userID, in); err != nil {
		return err
	}

	// File the scanned photo now that the entry it came from exists server-side.
	// A failure is logged, not returned: the entry is posted and immutable, so
	// reporting an error here would make the client resend a record that can
	// only fail as a duplicate. The unlinked image is reaped on schedule.
	if attID := strOr(rec, "attachment_id"); attID != "" && s.att != nil {
		if err := s.att.Link(ctx, ledgerID, attID, id); err != nil {
			slog.Error("link receipt attachment", "entry", id, "attachment", attID, "err", err)
		}
	}
	return nil
}

// indexLinesByEntry buckets journal_lines delta records by their entry_id.
func indexLinesByEntry(tc TableChanges) map[string][]map[string]any {
	out := map[string][]map[string]any{}
	for _, ln := range append(tc.Created, tc.Updated...) {
		eid := strOr(ln, "entry_id")
		if eid == "" {
			continue
		}
		out[eid] = append(out[eid], ln)
	}
	return out
}

func strID(rec map[string]any, key string) string {
	return strOr(rec, key)
}

func strOr(rec map[string]any, key string) string {
	v, ok := rec[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(v)
	}
}

func toInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case int:
		return int64(n), true
	case int64:
		return n, true
	default:
		return 0, false
	}
}

// toBoolOr reads a WMB boolean field, which arrives as a JSON bool but may be
// 0/1 from a SQLite-backed client.
func toBoolOr(v any, def bool) bool {
	switch b := v.(type) {
	case bool:
		return b
	case float64:
		return b != 0
	default:
		return def
	}
}

func toInt64Or(v any, def int64) int64 {
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int:
		return int64(n)
	case int64:
		return n
	default:
		return def
	}
}

// toTime accepts a WMB record field that may be an ISO date string or an ms
// epoch; zero-value when absent (ledger.Post defaults txn_date to today).
func toTime(v any) time.Time {
	switch t := v.(type) {
	case string:
		if parsed, err := time.Parse("2006-01-02", t); err == nil {
			return parsed
		}
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			return parsed
		}
	case float64:
		return time.UnixMilli(int64(t))
	}
	return time.Time{}
}
