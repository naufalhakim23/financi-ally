-- M4: fx_rates table + update balance trigger for multi-currency entries.
-- The trigger accepts entries with fx_rate IS NOT NULL (app-level balance
-- check handles conversion); single-currency entries still enforced.

CREATE TABLE fx_rates (
    base   char(3)  NOT NULL,
    quote  char(3)  NOT NULL,
    day    date     NOT NULL,
    rate   numeric  NOT NULL,
    source text     NOT NULL DEFAULT 'frankfurter',
    PRIMARY KEY (base, quote, day)
);

-- Entries with fx_rate set carry their own cross-currency rate; the
-- per-currency balance trigger is relaxed for these entries since lines
-- may be in different currencies and the app validates converted balances.
CREATE OR REPLACE FUNCTION assert_entries_balanced()
RETURNS trigger AS $$
DECLARE bad record;
BEGIN
    SELECT t.entry_id, t.currency INTO bad
    FROM (
        SELECT jl.entry_id, jl.currency
        FROM (SELECT DISTINCT entry_id FROM new_rows) touched
        CROSS JOIN LATERAL (
            SELECT e.id, e.currency, e.fx_rate
            FROM entries e
            WHERE e.id = touched.entry_id
        ) en
        CROSS JOIN LATERAL (
            SELECT entry_id, currency
            FROM journal_lines
            WHERE entry_id = touched.entry_id
            GROUP BY entry_id, currency
            HAVING COALESCE(SUM(amount_minor) FILTER (WHERE dc = 'debit'), 0)
                <> COALESCE(SUM(amount_minor) FILTER (WHERE dc = 'credit'), 0)
        ) jl
        WHERE en.fx_rate IS NULL
    ) t
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'unbalanced entry % for currency %', bad.entry_id, bad.currency
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
