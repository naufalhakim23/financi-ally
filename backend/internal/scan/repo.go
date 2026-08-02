package scan

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo is the metadata boundary. Rows always live in Postgres; only the bytes
// are pluggable (see BlobStore).
type Repo struct {
	db *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const colAttachment = "id, ledger_id, entry_id, mime, size_bytes, storage_key, created_at"

func scanAttachment(row pgx.Row) (*Attachment, error) {
	a := &Attachment{}
	if err := row.Scan(&a.ID, &a.LedgerID, &a.EntryID, &a.MIME, &a.SizeBytes,
		&a.StorageKey, &a.CreatedAt); err != nil {
		return nil, err
	}
	return a, nil
}

// Create records an uploaded image, unlinked until Link runs.
func (r *Repo) Create(ctx context.Context, a *Attachment) error {
	const q = `INSERT INTO entry_attachments (id, ledger_id, mime, size_bytes, storage_key)
		VALUES ($1, $2, $3, $4, $5)`
	if _, err := r.db.Exec(ctx, q, a.ID, a.LedgerID, a.MIME, a.SizeBytes, a.StorageKey); err != nil {
		return fmt.Errorf("create attachment: %w", err)
	}
	return nil
}

// Link binds an attachment to a confirmed entry. Restricted to still-unlinked
// rows, so a stale or forged id cannot re-point an image at a second entry.
func (r *Repo) Link(ctx context.Context, ledgerID, attachmentID, entryID string) error {
	const q = `UPDATE entry_attachments SET entry_id = $1
		WHERE id = $2 AND ledger_id = $3 AND entry_id IS NULL`
	tag, err := r.db.Exec(ctx, q, entryID, attachmentID, ledgerID)
	if err != nil {
		return fmt.Errorf("link attachment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrAttachmentNotFound
	}
	return nil
}

// ByEntry returns the attachment for an entry, ledger-scoped.
func (r *Repo) ByEntry(ctx context.Context, ledgerID, entryID string) (*Attachment, error) {
	const q = `SELECT ` + colAttachment + ` FROM entry_attachments
		WHERE ledger_id = $1 AND entry_id = $2`
	a, err := scanAttachment(r.db.QueryRow(ctx, q, ledgerID, entryID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAttachmentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("attachment by entry: %w", err)
	}
	return a, nil
}

// ConsumeQuota claims one scan for this user's UTC day and reports whether the
// claim was inside the cap. Increment and test are one statement, so two
// concurrent scans cannot both read the same count and both pass.
//
// A failed extraction still spends its unit: the call was paid for either way.
func (r *Repo) ConsumeQuota(ctx context.Context, userID string, limit int) (bool, error) {
	const q = `INSERT INTO scan_usage (user_id, day, count)
		VALUES ($1, (now() AT TIME ZONE 'utc')::date, 1)
		ON CONFLICT (user_id, day)
		DO UPDATE SET count = scan_usage.count + 1, updated_at = now()
		RETURNING count`
	var n int
	if err := r.db.QueryRow(ctx, q, userID).Scan(&n); err != nil {
		return false, fmt.Errorf("consume scan quota: %w", err)
	}
	return n <= limit, nil
}

// DeleteUsageBefore drops spent counters; the cap only ever asks about today.
func (r *Repo) DeleteUsageBefore(ctx context.Context, day time.Time) error {
	const q = `DELETE FROM scan_usage WHERE day < $1::date`
	if _, err := r.db.Exec(ctx, q, day); err != nil {
		return fmt.Errorf("reap scan usage: %w", err)
	}
	return nil
}

// DeleteUnlinkedBefore removes never-confirmed attachments, returning their
// storage keys so the caller can drop the bytes too.
//
// Rows first, blobs second: a crash between the two leaks an unreferenced blob,
// where the reverse leaves a row pointing at bytes that are gone.
func (r *Repo) DeleteUnlinkedBefore(ctx context.Context, cutoff time.Time) ([]string, error) {
	const q = `DELETE FROM entry_attachments
		WHERE entry_id IS NULL AND created_at < $1
		RETURNING storage_key`
	rows, err := r.db.Query(ctx, q, cutoff)
	if err != nil {
		return nil, fmt.Errorf("reap attachments: %w", err)
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, fmt.Errorf("reap attachments: %w", err)
		}
		keys = append(keys, k)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reap attachments: %w", err)
	}
	return keys, nil
}
