-- M3: switch synced tables to client-generated text IDs (WatermelonDB-native).
-- WMB creates records on-device with its own random id before any server
-- round-trip, and the server must store that id verbatim as the PK. So
-- accounts/entries/journal_lines/budgets drop DEFAULT gen_random_uuid() and
-- take text PKs; their mutual FKs follow. users.id stays uuid (server owns it
-- at register; users are not a synced table). The REST create paths now
-- generate a server uuid when no client id is supplied.
--
-- Drop the cross-table FKs that cross the uuid→text boundary, change column
-- types, then recreate them. user_id FKs (→ users, still uuid) are untouched.

ALTER TABLE accounts         DROP CONSTRAINT accounts_parent_id_fkey;
ALTER TABLE journal_lines    DROP CONSTRAINT journal_lines_entry_id_fkey;
ALTER TABLE journal_lines    DROP CONSTRAINT journal_lines_account_id_fkey;
ALTER TABLE budgets          DROP CONSTRAINT budgets_account_id_fkey;

-- accounts: own PK + parent self-ref
ALTER TABLE accounts ALTER COLUMN id        TYPE text USING id::text;
ALTER TABLE accounts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE accounts ALTER COLUMN parent_id TYPE text USING parent_id::text;

-- entries: own PK
ALTER TABLE entries ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE entries ALTER COLUMN id DROP DEFAULT;

-- journal_lines: own PK + entry/account refs
ALTER TABLE journal_lines ALTER COLUMN id         TYPE text USING id::text;
ALTER TABLE journal_lines ALTER COLUMN id DROP DEFAULT;
ALTER TABLE journal_lines ALTER COLUMN entry_id   TYPE text USING entry_id::text;
ALTER TABLE journal_lines ALTER COLUMN account_id TYPE text USING account_id::text;

-- budgets: own PK + account ref
ALTER TABLE budgets ALTER COLUMN id         TYPE text USING id::text;
ALTER TABLE budgets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE budgets ALTER COLUMN account_id TYPE text USING account_id::text;

-- Recreate the cross-table FKs on the now-text columns.
ALTER TABLE accounts      ADD CONSTRAINT accounts_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_entry_id_fkey
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE budgets       ADD CONSTRAINT budgets_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
