-- M3: monthly category budgets. A budget targets an expense account (a
-- category) for a month. Spent is derived live from posted debit lines in that
-- month, so budgets never store a running total. Like accounts, budgets are a
-- synced mutable (updated_at drives M3 WatermelonDB LWW).
CREATE TABLE budgets (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id   uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_month date        NOT NULL,            -- first day of the month (YYYY-MM-01)
    target_minor bigint      NOT NULL CHECK (target_minor >= 0),
    currency     char(3)     NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, account_id, period_month),
    CHECK (period_month = date_trunc('month', period_month)::date) -- must be month-start
);
CREATE INDEX budgets_user_period_idx ON budgets(user_id, period_month);
