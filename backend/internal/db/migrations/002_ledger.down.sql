-- Reverse of 002_ledger. Drop in reverse dependency order.
DROP TRIGGER IF EXISTS entries_must_balance ON journal_lines;
DROP FUNCTION IF EXISTS assert_entries_balanced();
DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS accounts;
