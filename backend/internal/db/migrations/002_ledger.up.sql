-- M2: ledger core. accounts (5-type chart of accounts), entries (journal
-- headers), journal_lines (the balanced legs). Double-entry: every entry's
-- debit total equals its credit total per currency. Enforced both in the
-- application (ledger.Post) and by a deferred trigger below as defense in depth.

-- Accounts: pockets (asset/liability) and categories (income/expense/equity)
-- are the same table distinguished by type — a real chart of accounts.
CREATE TABLE accounts (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       text        NOT NULL CHECK (type IN ('asset','liability','income','expense','equity')),
    currency   char(3)     NOT NULL,
    name       text        NOT NULL,
    parent_id  uuid        REFERENCES accounts(id) ON DELETE SET NULL, -- tree (forward-compat; not traversed in M2)
    archived   boolean     NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),  -- LWW watermark for M3 sync
    deleted_at timestamptz,                          -- soft-delete (metadata only; M3 sync)
    UNIQUE (user_id, type, name)
);
CREATE INDEX accounts_user_id_idx ON accounts(user_id);

-- Entries: the journal header. Posted entries are immutable — corrections are
-- reversing entries, which keeps offline sync conflict-free. updated_at is
-- server-set (drives M3 WatermelonDB pull filtering via last_pulled_at).
CREATE TABLE entries (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    txn_date   date        NOT NULL,
    status     text        NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted')),
    currency   char(3)     NOT NULL,
    fx_rate    numeric,                -- cross-currency rate; null for single-currency entries (M4)
    source     text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','recurring','import')),
    memo       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz             -- soft (drafts only)
);
CREATE INDEX entries_user_id_idx ON entries(user_id);
CREATE INDEX entries_user_date_idx ON entries(user_id, txn_date DESC);

-- Journal lines: the balanced legs. amount_minor is unsigned integer minor
-- units; sign comes from dc combined with the account's normal balance.
CREATE TABLE journal_lines (
    id           uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id     uuid   NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    account_id   uuid   NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    dc           text   NOT NULL CHECK (dc IN ('debit','credit')),
    amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
    currency     char(3) NOT NULL
);
CREATE INDEX journal_lines_entry_id_idx ON journal_lines(entry_id);
CREATE INDEX journal_lines_account_id_idx ON journal_lines(account_id);

-- Balance invariant, enforced server-side as defense in depth under the single
-- ledger.Post entrypoint. A plain AFTER STATEMENT trigger (constraint triggers
-- can't take a REFERENCING transition table in this PG) re-reads the touched
-- entries and asserts debit total = credit total per currency. ledger.Post
-- inserts all of an entry's lines in one statement, so the trigger sees the
-- complete set; the application layer asserts the same invariant in-transaction
-- as the primary guard, so a future multi-statement writer is still safe.
CREATE OR REPLACE FUNCTION assert_entries_balanced()
RETURNS trigger AS $$
DECLARE bad record;
BEGIN
    SELECT t.entry_id, t.currency INTO bad
    FROM (
        SELECT jl.entry_id, jl.currency
        FROM (SELECT DISTINCT entry_id FROM new_rows) touched
        CROSS JOIN LATERAL (
            SELECT entry_id, currency
            FROM journal_lines
            WHERE entry_id = touched.entry_id
            GROUP BY entry_id, currency
            HAVING COALESCE(SUM(amount_minor) FILTER (WHERE dc = 'debit'), 0)
                <> COALESCE(SUM(amount_minor) FILTER (WHERE dc = 'credit'), 0)
        ) jl
    ) t
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'unbalanced entry % for currency %', bad.entry_id, bad.currency
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Two single-event triggers: PG disallows transition tables on a multi-event
-- trigger ("INSERT OR UPDATE"), so one per event shares the function.
CREATE TRIGGER entries_must_balance_ins
AFTER INSERT ON journal_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION assert_entries_balanced();

CREATE TRIGGER entries_must_balance_upd
AFTER UPDATE ON journal_lines
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION assert_entries_balanced();

