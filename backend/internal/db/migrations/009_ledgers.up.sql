-- M8: shared ledgers. A ledger is a book of accounts; until now every book was
-- implicitly "the rows owned by one user". Sharing needs the book to be a real
-- row people can be members of, so the scope column on every money table moves
-- from user_id to ledger_id.
--
-- The tenancy scalar stays a scalar: repos still take one id, just a different
-- one. That is why this migration is large but the Go diff is a rename. See
-- docs/decision_logs/0010-m8-shared-ledgers.md.

CREATE TABLE ledgers (
    id            text        NOT NULL PRIMARY KEY,
    name          text        NOT NULL,
    -- The book's own reporting currency. Reports used to normalize to
    -- users.base_currency, which is wrong for a shared book: two members with
    -- different personal defaults must still read the same household totals.
    base_currency char(3)     NOT NULL,
    kind          text        NOT NULL CHECK (kind IN ('personal','household')),
    -- ON DELETE CASCADE mirrors the pre-M8 behaviour (deleting a user deleted
    -- their money rows). ponytail: there is no delete-user path in the app; if
    -- one is ever added, a household created by the leaver must be transferred
    -- to another owner rather than cascaded away.
    created_by    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);

-- Exactly one personal book per user; households are unlimited.
CREATE UNIQUE INDEX ledgers_one_personal_per_user
    ON ledgers (created_by) WHERE kind = 'personal' AND deleted_at IS NULL;

CREATE TABLE ledger_members (
    ledger_id text        NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    user_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      text        NOT NULL CHECK (role IN ('owner','member')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ledger_id, user_id)
);
-- The hot path: "which books may this user open?" on every request.
CREATE INDEX ledger_members_user_idx ON ledger_members(user_id);

-- Join codes. No mailer exists in this service, so joining is code-based: the
-- owner shows a short code, the invitee types it. The code IS the credential,
-- hence the expiry and the revoke column.
CREATE TABLE ledger_invites (
    code       text        NOT NULL PRIMARY KEY,
    ledger_id  text        NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    created_by uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_invites_ledger_idx ON ledger_invites(ledger_id) WHERE revoked_at IS NULL;

-- --------------------------------------------------------------------------
-- Backfill: every existing user gets a personal ledger holding everything they
-- already own. gen_random_uuid()::text because the synced tables use text ids.
-- --------------------------------------------------------------------------
INSERT INTO ledgers (id, name, base_currency, kind, created_by)
SELECT gen_random_uuid()::text, 'Personal', u.base_currency, 'personal', u.id
FROM users u;

INSERT INTO ledger_members (ledger_id, user_id, role)
SELECT l.id, l.created_by, 'owner' FROM ledgers l;

-- --------------------------------------------------------------------------
-- Re-scope the money tables. Each: add nullable ledger_id → backfill from the
-- owner's personal ledger → SET NOT NULL → swap constraints/indexes → retire
-- user_id.
-- --------------------------------------------------------------------------

-- accounts ------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN ledger_id text REFERENCES ledgers(id) ON DELETE CASCADE;
UPDATE accounts a SET ledger_id = l.id
    FROM ledgers l WHERE l.created_by = a.user_id AND l.kind = 'personal';
ALTER TABLE accounts ALTER COLUMN ledger_id SET NOT NULL;

-- Names are unique within a book, not within a person: two members must not be
-- able to create two "Groceries" categories in the same household.
ALTER TABLE accounts DROP CONSTRAINT accounts_user_id_type_name_key;
ALTER TABLE accounts ADD CONSTRAINT accounts_ledger_type_name_key UNIQUE (ledger_id, type, name);
DROP INDEX accounts_user_id_idx;
CREATE INDEX accounts_ledger_id_idx ON accounts(ledger_id);

-- Dropped rather than kept as a nullable owner_user_id: no write path sets it,
-- so it would only ever be NULL. M9 settle-up can add it when it has something
-- to put in it.
ALTER TABLE accounts DROP COLUMN user_id;

-- entries -------------------------------------------------------------------
ALTER TABLE entries ADD COLUMN ledger_id text REFERENCES ledgers(id) ON DELETE CASCADE;
UPDATE entries e SET ledger_id = l.id
    FROM ledgers l WHERE l.created_by = e.user_id AND l.kind = 'personal';
ALTER TABLE entries ALTER COLUMN ledger_id SET NOT NULL;

DROP INDEX entries_user_id_idx;
DROP INDEX entries_user_date_idx;
CREATE INDEX entries_ledger_id_idx   ON entries(ledger_id);
CREATE INDEX entries_ledger_date_idx ON entries(ledger_id, txn_date DESC);

-- Kept, not dropped: in a shared book "who logged this" is information the
-- ledger cannot reconstruct, and M9 splitting builds on it. Nullable now,
-- because entries the recurring scheduler materializes have no human author.
ALTER TABLE entries RENAME COLUMN user_id TO created_by_user_id;
ALTER TABLE entries ALTER COLUMN created_by_user_id DROP NOT NULL;

-- budgets -------------------------------------------------------------------
ALTER TABLE budgets ADD COLUMN ledger_id text REFERENCES ledgers(id) ON DELETE CASCADE;
UPDATE budgets b SET ledger_id = l.id
    FROM ledgers l WHERE l.created_by = b.user_id AND l.kind = 'personal';
ALTER TABLE budgets ALTER COLUMN ledger_id SET NOT NULL;

-- A household has one target per category per month, not one per member.
ALTER TABLE budgets DROP CONSTRAINT budgets_user_id_account_id_period_month_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_ledger_account_period_key
    UNIQUE (ledger_id, account_id, period_month);
DROP INDEX budgets_user_period_idx;
CREATE INDEX budgets_ledger_period_idx ON budgets(ledger_id, period_month);
ALTER TABLE budgets DROP COLUMN user_id;

-- recurring_rules -----------------------------------------------------------
ALTER TABLE recurring_rules ADD COLUMN ledger_id text REFERENCES ledgers(id) ON DELETE CASCADE;
UPDATE recurring_rules r SET ledger_id = l.id
    FROM ledgers l WHERE l.created_by = r.user_id AND l.kind = 'personal';
ALTER TABLE recurring_rules ALTER COLUMN ledger_id SET NOT NULL;

DROP INDEX idx_recurring_rules_user;
CREATE INDEX idx_recurring_rules_ledger ON recurring_rules (ledger_id) WHERE deleted_at IS NULL;
ALTER TABLE recurring_rules DROP COLUMN user_id;
