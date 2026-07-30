-- M6 hardening: make materialization idempotent and rule failures visible.
--
-- 1. entries.recurring_rule_id links a posted entry back to the rule that
--    produced it — traceability the `source='recurring'` flag alone can't give.
-- 2. The partial unique index is the actual idempotency guard: one entry per
--    (rule, occurrence date). It holds across scheduler ticks AND across server
--    replicas, which an application-level check never could.
-- 3. last_error/last_error_at surface a rule that keeps failing to post
--    (deleted account, unbalanced template) instead of burying it in logs.

ALTER TABLE entries
    ADD COLUMN recurring_rule_id text REFERENCES recurring_rules(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX entries_recurring_occurrence_uniq
    ON entries (recurring_rule_id, txn_date)
    WHERE recurring_rule_id IS NOT NULL;

ALTER TABLE recurring_rules
    ADD COLUMN last_error    text,
    ADD COLUMN last_error_at timestamptz;
