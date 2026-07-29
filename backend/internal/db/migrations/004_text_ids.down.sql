-- Reverse of 004_text_ids. FKs dropped/recreated back to uuid. NOTE: this only
-- works cleanly while all stored ids are valid uuids (no WMB client ids yet).
ALTER TABLE accounts      DROP CONSTRAINT accounts_parent_id_fkey;
ALTER TABLE journal_lines DROP CONSTRAINT journal_lines_entry_id_fkey;
ALTER TABLE journal_lines DROP CONSTRAINT journal_lines_account_id_fkey;
ALTER TABLE budgets       DROP CONSTRAINT budgets_account_id_fkey;

ALTER TABLE accounts ALTER COLUMN parent_id TYPE uuid USING parent_id::uuid;
ALTER TABLE accounts ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE entries ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE entries ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE journal_lines ALTER COLUMN entry_id   TYPE uuid USING entry_id::uuid;
ALTER TABLE journal_lines ALTER COLUMN account_id TYPE uuid USING account_id::uuid;
ALTER TABLE journal_lines ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE journal_lines ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE budgets ALTER COLUMN account_id TYPE uuid USING account_id::uuid;
ALTER TABLE budgets ALTER COLUMN id TYPE uuid USING id::uuid;
ALTER TABLE budgets ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE accounts      ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE budgets       ADD CONSTRAINT budgets_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
