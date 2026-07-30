DROP INDEX IF EXISTS entries_recurring_occurrence_uniq;
ALTER TABLE entries DROP COLUMN IF EXISTS recurring_rule_id;
ALTER TABLE recurring_rules DROP COLUMN IF EXISTS last_error, DROP COLUMN IF EXISTS last_error_at;
