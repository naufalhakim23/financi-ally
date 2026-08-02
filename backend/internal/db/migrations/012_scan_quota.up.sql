-- Per-user daily scan counter. Every /scan/receipt call costs a vision-model
-- request, so without a cap one client in a loop drains the budget for everyone.
--
-- Counted per UTC day: this is a spend guard, not a user-facing quota, and a
-- per-user calendar would need a stored timezone this table should not own.
CREATE TABLE scan_usage (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        date NOT NULL,
    count      integer NOT NULL DEFAULT 0 CHECK (count >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);

-- The reaper sweeps past days on the same schedule it collects abandoned images.
CREATE INDEX scan_usage_day_idx ON scan_usage (day);
