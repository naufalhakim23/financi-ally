// Package sync implements the WatermelonDB pull/push protocol against the
// ledger. The mobile is offline-first: it writes accounts/entries/lines/budgets
// to a local WatermelonDB with client-generated ids, then reconciles through
// /sync/pull (changes since a watermark) and /sync/push (client changes).
//
// The model is safe for money because posted entries are immutable — there is
// never an amount to merge. The only mutables are metadata (account name,
// budget target), settled last-write-wins by server updated_at at push time.
// Single-user personal scale; per-record vector clocks would be the upgrade if
// true concurrent multi-device edits on metadata ever matter (they don't here).
package sync

// TableChanges is one table's delta in a WatermelonDB changeset: records to
// create, records to update, and ids to delete.
type TableChanges struct {
	Created []map[string]any `json:"created,omitempty"`
	Updated []map[string]any `json:"updated,omitempty"`
	Deleted []string         `json:"deleted,omitempty"`
}

// ChangeSet maps a table name (accounts, entries, journal_lines, budgets) to
// its delta.
type ChangeSet map[string]TableChanges

// PullResponse is the /sync/pull reply: changes since the client's watermark
// plus a new watermark (ms epoch) to present next time.
type PullResponse struct {
	Changes   ChangeSet `json:"changes"`
	Timestamp int64     `json:"timestamp"`
}

// PushRequest is the /sync/push body.
type PushRequest struct {
	Changes ChangeSet `json:"changes"`
}

// PushResponse carries per-record errors. A record that failed validation
// (e.g. an unbalanced pushed entry) is keyed by its client id with a message;
// accepted records are absent. Nothing is ever silently dropped on a money path.
type PushResponse struct {
	Errors map[string]string `json:"errors,omitempty"`
}

// syncedTables is the fixed set this server syncs, in pull order.
var syncedTables = []string{"accounts", "entries", "journal_lines", "budgets"}
