-- Password reset. A short numeric code is emailed and typed back into the app —
-- not a link — because the client is a native app and a link would need a
-- verified deep-link/universal-link setup on both platforms to be reliable.
--
-- Only the sha256 of the code is stored, same discipline as refresh_tokens: the
-- raw code exists in the email and nowhere else.
CREATE TABLE password_resets (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   bytea       NOT NULL,
    expires_at  timestamptz NOT NULL,
    consumed_at timestamptz,
    -- Wrong guesses against a 6-digit code are cheap; the counter is what makes
    -- brute force expensive. Burned at a fixed ceiling, not rate-limited by IP.
    attempts    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Every lookup is "the live request for this user", so the index carries the
-- liveness predicate rather than filtering a full per-user scan.
CREATE INDEX password_resets_live_idx
    ON password_resets(user_id)
    WHERE consumed_at IS NULL;
