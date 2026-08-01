-- Reverse M8. Lossy by nature: rows in a household book collapse back onto the
-- book creator, because single-user scoping has nowhere else to put them. Any
-- membership beyond the creator is dropped.

-- recurring_rules -----------------------------------------------------------
ALTER TABLE recurring_rules ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE recurring_rules r SET user_id = l.created_by FROM ledgers l WHERE l.id = r.ledger_id;
ALTER TABLE recurring_rules ALTER COLUMN user_id SET NOT NULL;
DROP INDEX idx_recurring_rules_ledger;
CREATE INDEX idx_recurring_rules_user ON recurring_rules (user_id) WHERE deleted_at IS NULL;
ALTER TABLE recurring_rules DROP COLUMN ledger_id;

-- budgets -------------------------------------------------------------------
ALTER TABLE budgets ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE budgets b SET user_id = l.created_by FROM ledgers l WHERE l.id = b.ledger_id;
ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budgets DROP CONSTRAINT budgets_ledger_account_period_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_account_id_period_month_key
    UNIQUE (user_id, account_id, period_month);
DROP INDEX budgets_ledger_period_idx;
CREATE INDEX budgets_user_period_idx ON budgets(user_id, period_month);
ALTER TABLE budgets DROP COLUMN ledger_id;

-- entries -------------------------------------------------------------------
ALTER TABLE entries RENAME COLUMN created_by_user_id TO user_id;
-- Scheduler-posted entries have no author; hand them to the book creator so
-- the original NOT NULL can be restored.
UPDATE entries e SET user_id = l.created_by
    FROM ledgers l WHERE l.id = e.ledger_id AND e.user_id IS NULL;
ALTER TABLE entries ALTER COLUMN user_id SET NOT NULL;
DROP INDEX entries_ledger_id_idx;
DROP INDEX entries_ledger_date_idx;
CREATE INDEX entries_user_id_idx   ON entries(user_id);
CREATE INDEX entries_user_date_idx ON entries(user_id, txn_date DESC);
ALTER TABLE entries DROP COLUMN ledger_id;

-- accounts ------------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE accounts a SET user_id = l.created_by FROM ledgers l WHERE l.id = a.ledger_id;
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT accounts_ledger_type_name_key;
ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_type_name_key UNIQUE (user_id, type, name);
DROP INDEX accounts_ledger_id_idx;
CREATE INDEX accounts_user_id_idx ON accounts(user_id);
ALTER TABLE accounts DROP COLUMN ledger_id;

DROP TABLE ledger_invites;
DROP TABLE ledger_members;
DROP TABLE ledgers;
