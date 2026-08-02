-- M10: receipt scanning.
--
-- Two tables rather than one because bytes and metadata have different futures.
-- Metadata is tenancy-scoped and always lives in Postgres; the bytes sit behind
-- scan.BlobStore and are expected to move to an object store. Swapping the store
-- then means dropping attachment_blobs, not migrating the rows the app queries.

ALTER TABLE entries DROP CONSTRAINT entries_source_check;
ALTER TABLE entries ADD CONSTRAINT entries_source_check
    CHECK (source IN ('manual','recurring','import','receipt_scan'));

-- entry_id is nullable on purpose: the image is uploaded when the scan runs,
-- before the human confirms anything, and stays un-linked until they do.
CREATE TABLE entry_attachments (
    id          text        NOT NULL PRIMARY KEY,
    ledger_id   text        NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    -- NULL until the draft is confirmed and posted.
    entry_id    text        REFERENCES entries(id) ON DELETE CASCADE,
    mime        text        NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
    size_bytes  integer     NOT NULL CHECK (size_bytes > 0),
    -- Opaque to everything except the BlobStore that minted it.
    storage_key text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- The read path: "show me the photo for this entry".
CREATE INDEX entry_attachments_entry_idx ON entry_attachments(entry_id)
    WHERE entry_id IS NOT NULL;
-- The reaper's path: unconfirmed uploads, oldest first.
CREATE INDEX entry_attachments_unlinked_idx ON entry_attachments(created_at)
    WHERE entry_id IS NULL;

-- Blob bytes. Owned solely by scan.pgBlobStore, which is what makes the store
-- swappable.
--
-- created_at exists for garbage collection, not reads: entry_attachments rows
-- vanish by cascade and that cascade cannot reach here, so a sweeper collects
-- blobs with no surviving metadata row. The timestamp is what stops it deleting
-- a scan that has written its blob but not yet its row.
CREATE TABLE attachment_blobs (
    key        text        NOT NULL PRIMARY KEY,
    data       bytea       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachment_blobs_created_idx ON attachment_blobs(created_at);
