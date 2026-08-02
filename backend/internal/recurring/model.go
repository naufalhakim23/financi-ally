// Package recurring owns the RRULE-based scheduler for automatic transactions.
// Each rule defines a recurrence pattern (iCalendar RRULE) and a JSONB template
// that is materialized into a posted entry on each occurrence. The scheduler
// runs as a background goroutine that checks for due rules and posts entries.
package recurring

import (
	"encoding/json"
	"time"
)

// Template is the entry skeleton that gets materialized on each occurrence.
type Template struct {
	Currency string         `json:"currency"`
	Memo     string         `json:"memo,omitempty"`
	Source   string         `json:"source"`
	Lines    []TemplateLine `json:"lines"`
}

// TemplateLine is one leg of the entry skeleton.
type TemplateLine struct {
	AccountID   string `json:"account_id"`
	DC          string `json:"dc"`
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency,omitempty"`
}

// RecurringRule defines a scheduled recurring transaction. LastError records
// why the most recent materialization failed (e.g. the template's account was
// archived) so a silently-stuck rule is visible in the UI instead of only in
// the server log; it is cleared on the next successful post.
type RecurringRule struct {
	ID          string
	LedgerID    string
	RRule       string
	Template    Template
	NextRun     *time.Time
	LastRun     *time.Time
	Active      bool
	LastError   *string
	LastErrorAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   *time.Time
}

// MarshalTemplate serializes a Template to JSON bytes for DB storage.
func MarshalTemplate(t Template) ([]byte, error) {
	return json.Marshal(t)
}

// UnmarshalTemplate deserializes JSON bytes into a Template.
func UnmarshalTemplate(data []byte) (Template, error) {
	var t Template
	err := json.Unmarshal(data, &t)
	return t, err
}
