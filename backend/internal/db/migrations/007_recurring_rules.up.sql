-- M6: recurring_rules table — RRULE-based scheduler for automatic transactions.
-- Each rule stores a recurrence pattern (iCalendar RRULE) and a JSONB template
-- that is materialized into a posted entry on each occurrence.

CREATE TABLE recurring_rules (
    id          text        NOT NULL PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rrule       text        NOT NULL,
    template    jsonb       NOT NULL,
    next_run    date,
    last_run    date,
    active      boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE INDEX idx_recurring_rules_active_next ON recurring_rules (active, next_run)
    WHERE active = true AND next_run IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_recurring_rules_user ON recurring_rules (user_id)
    WHERE deleted_at IS NULL;
