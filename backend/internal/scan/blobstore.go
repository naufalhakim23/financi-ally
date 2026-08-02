package scan

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgBlobStore keeps attachment bytes in Postgres. A household's receipts are
// tens of megabytes a year, which TOAST handles without anyone noticing, and it
// costs no new dependency or credential.
//
// ponytail: the ceiling is backup weight and single-node disk. When pg_dump gets
// painful, write an s3BlobStore against the same interface, copy
// attachment_blobs across, and drop the table. Nothing outside this file reads
// it.
type pgBlobStore struct {
	db *pgxpool.Pool
}

func NewPostgresBlobStore(pool *pgxpool.Pool) BlobStore { return &pgBlobStore{db: pool} }

// mime is ignored: the metadata row records it. An object store would use it.
func (s *pgBlobStore) Put(ctx context.Context, key, _ string, data []byte) error {
	const q = `INSERT INTO attachment_blobs (key, data) VALUES ($1, $2)`
	if _, err := s.db.Exec(ctx, q, key, data); err != nil {
		return fmt.Errorf("put blob: %w", err)
	}
	return nil
}

func (s *pgBlobStore) Get(ctx context.Context, key string) ([]byte, error) {
	const q = `SELECT data FROM attachment_blobs WHERE key = $1`
	var data []byte
	err := s.db.QueryRow(ctx, q, key).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAttachmentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get blob: %w", err)
	}
	return data, nil
}

// Missing keys are not an error: the reaper deletes metadata first, so a
// retried sweep can legitimately ask twice.
func (s *pgBlobStore) Delete(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	const q = `DELETE FROM attachment_blobs WHERE key = ANY($1)`
	if _, err := s.db.Exec(ctx, q, keys); err != nil {
		return fmt.Errorf("delete blobs: %w", err)
	}
	return nil
}

// DeleteOrphansBefore collects bytes no attachment row references any more —
// without it every deleted ledger leaks its receipts forever.
//
// The cutoff is what makes it safe to run alongside a scan: Scan puts the blob
// before it inserts the row, and a young blob in that window looks like an
// orphan.
func (s *pgBlobStore) DeleteOrphansBefore(ctx context.Context, cutoff time.Time) (int, error) {
	const q = `DELETE FROM attachment_blobs b
		WHERE b.created_at < $1
		  AND NOT EXISTS (SELECT 1 FROM entry_attachments a WHERE a.storage_key = b.key)`
	tag, err := s.db.Exec(ctx, q, cutoff)
	if err != nil {
		return 0, fmt.Errorf("delete orphan blobs: %w", err)
	}
	return int(tag.RowsAffected()), nil
}
