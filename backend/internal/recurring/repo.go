package recurring

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRuleNotFound = errors.New("recurring rule not found")
)

// Repo is the persistence boundary for recurring rules. Raw SQL via pgx.
type Repo struct {
	db *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const colRule = `id, user_id, rrule, template, next_run, last_run, active,
	last_error, last_error_at, created_at, updated_at, deleted_at`

func scanRule(row pgx.Row) (*RecurringRule, error) {
	r := &RecurringRule{}
	var tmplBytes []byte
	var nextRun, lastRun *time.Time
	if err := row.Scan(&r.ID, &r.UserID, &r.RRule, &tmplBytes, &nextRun, &lastRun,
		&r.Active, &r.LastError, &r.LastErrorAt, &r.CreatedAt, &r.UpdatedAt, &r.DeletedAt); err != nil {
		return nil, err
	}
	t, err := UnmarshalTemplate(tmplBytes)
	if err != nil {
		return nil, fmt.Errorf("unmarshal template: %w", err)
	}
	r.Template = t
	r.NextRun = nextRun
	r.LastRun = lastRun
	return r, nil
}

// Create inserts a new recurring rule with its first computed occurrence, so a
// rule is never persisted in a half-initialized state (no next_run).
func (r *Repo) Create(ctx context.Context, id, userID, rrule string, tmplBytes []byte, nextRun *time.Time, active bool) (*RecurringRule, error) {
	rule, err := scanRule(r.db.QueryRow(ctx, `
		INSERT INTO recurring_rules (id, user_id, rrule, template, next_run, active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+colRule,
		id, userID, rrule, tmplBytes, nextRun, active))
	if err != nil {
		return nil, fmt.Errorf("create recurring rule: %w", err)
	}
	return rule, nil
}

// Get fetches one rule scoped to the user.
func (r *Repo) Get(ctx context.Context, userID, id string) (*RecurringRule, error) {
	rule, err := scanRule(r.db.QueryRow(ctx,
		`SELECT `+colRule+` FROM recurring_rules WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRuleNotFound
		}
		return nil, fmt.Errorf("get recurring rule: %w", err)
	}
	return rule, nil
}

// List returns a user's non-deleted recurring rules.
func (r *Repo) List(ctx context.Context, userID string) ([]*RecurringRule, error) {
	return r.queryRules(ctx,
		`SELECT `+colRule+` FROM recurring_rules
		 WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, userID)
}

// Update rewrites a rule's definition and its recomputed next_run. A rule that
// changed shape has no meaningful pending error, so last_error is cleared.
func (r *Repo) Update(ctx context.Context, userID, id, rrule string, tmplBytes []byte, nextRun *time.Time, active bool) (*RecurringRule, error) {
	rule, err := scanRule(r.db.QueryRow(ctx, `
		UPDATE recurring_rules
		SET rrule = $3, template = $4, next_run = $5, active = $6,
		    last_error = NULL, last_error_at = NULL, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		RETURNING `+colRule,
		id, userID, rrule, tmplBytes, nextRun, active))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRuleNotFound
		}
		return nil, fmt.Errorf("update recurring rule: %w", err)
	}
	return rule, nil
}

// Advance records a successful materialization: last_run moves to the occurrence
// just posted, next_run to the following one (nil + inactive when exhausted).
func (r *Repo) Advance(ctx context.Context, id string, nextRun, lastRun *time.Time, active bool) error {
	_, err := r.db.Exec(ctx, `
		UPDATE recurring_rules
		SET next_run = $2, last_run = $3, active = $4,
		    last_error = NULL, last_error_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id, nextRun, lastRun, active)
	if err != nil {
		return fmt.Errorf("advance recurring rule: %w", err)
	}
	return nil
}

// RecordError stores why a materialization failed. next_run is left untouched so
// the rule retries on the next tick — a transient failure self-heals, and a
// permanent one stays visible to the user via last_error.
func (r *Repo) RecordError(ctx context.Context, id, msg string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE recurring_rules
		SET last_error = $2, last_error_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id, msg)
	if err != nil {
		return fmt.Errorf("record recurring error: %w", err)
	}
	return nil
}

// Delete soft-deletes a recurring rule.
func (r *Repo) Delete(ctx context.Context, userID, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE recurring_rules SET deleted_at = now(), updated_at = now()
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, userID)
	if err != nil {
		return fmt.Errorf("delete recurring rule: %w", err)
	}
	return nil
}

// DueRules returns active rules whose next_run is on or before the cutoff.
// userID scopes the sweep to one user (the manual trigger endpoint); empty
// sweeps every user (the background scheduler).
func (r *Repo) DueRules(ctx context.Context, userID string, cutoff time.Time) ([]*RecurringRule, error) {
	q := `SELECT ` + colRule + ` FROM recurring_rules
		  WHERE active = true AND next_run IS NOT NULL AND next_run <= $1 AND deleted_at IS NULL`
	args := []any{cutoff}
	if userID != "" {
		q += ` AND user_id = $2`
		args = append(args, userID)
	}
	return r.queryRules(ctx, q+` ORDER BY next_run ASC`, args...)
}

func (r *Repo) queryRules(ctx context.Context, q string, args ...any) ([]*RecurringRule, error) {
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("query recurring rules: %w", err)
	}
	defer rows.Close()
	var out []*RecurringRule
	for rows.Next() {
		rule, err := scanRule(rows)
		if err != nil {
			return nil, fmt.Errorf("scan recurring rule: %w", err)
		}
		out = append(out, rule)
	}
	return out, rows.Err()
}
