DROP TABLE IF EXISTS attachment_blobs;
DROP TABLE IF EXISTS entry_attachments;

-- Any receipt-scanned entries must lose the source value the old constraint
-- rejects, or re-adding it fails. They stay as manual entries — which is what
-- they effectively are once the scan feature is gone.
UPDATE entries SET source = 'manual' WHERE source = 'receipt_scan';
ALTER TABLE entries DROP CONSTRAINT entries_source_check;
ALTER TABLE entries ADD CONSTRAINT entries_source_check
    CHECK (source IN ('manual','recurring','import'));
