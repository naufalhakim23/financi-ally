-- M1: auth core. users, refresh_tokens (hashed, rotated), oauth_identities.
-- gen_random_uuid() is built into Postgres core (no extension needed on 13+).

CREATE TABLE users (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        text        NOT NULL UNIQUE,
    password_hash text,              -- NULL for OAuth-only users (no password set)
    base_currency char(3)     NOT NULL DEFAULT 'IDR',
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Opaque refresh tokens are stored hashed (sha256); the raw token leaves the
-- server only at issue time. Rotate-on-use: a refresh revokes itself and mints
-- a replacement, so a stolen token is single-use.
CREATE TABLE refresh_tokens (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea       NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens(user_id);

-- One user may have identities from multiple providers; provider+provider_uid
-- is globally unique per provider.
CREATE TABLE oauth_identities (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     text        NOT NULL CHECK (provider IN ('google', 'apple')),
    provider_uid text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_uid)
);
CREATE INDEX oauth_identities_user_id_idx ON oauth_identities(user_id);
