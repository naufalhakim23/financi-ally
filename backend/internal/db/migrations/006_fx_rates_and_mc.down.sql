-- Revert trigger to M2 per-currency enforcement.
DROP TABLE IF EXISTS fx_rates;

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
