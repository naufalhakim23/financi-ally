-- M3: soft-delete support on budgets so WatermelonDB sync can communicate
-- budget deletions (a hard DELETE loses the id, so pull can't enumerate it).
-- Matches the accounts/entries deleted_at convention.
ALTER TABLE budgets ADD COLUMN deleted_at timestamptz;
