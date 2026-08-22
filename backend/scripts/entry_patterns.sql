-- Entry-pattern analysis behind `make analyze`. One section per open question
-- in the capture design. Meaningless until a few weeks of daily use exist.

\echo '=== 1. Volume: is there enough data to trust any of this? ==='
SELECT
    count(*)                                      AS entries,
    count(DISTINCT txn_date)                      AS days_with_entries,
    min(txn_date)                                 AS first_entry,
    max(txn_date)                                 AS last_entry,
    round(count(*)::numeric
        / GREATEST(max(txn_date) - min(txn_date) + 1, 1), 2) AS entries_per_calendar_day
FROM entries
WHERE deleted_at IS NULL;

\echo ''
\echo '=== 2. Mode mix: is "out" really the default the screen assumes? ==='
-- Mode is not stored; it is the shape of the pair.
WITH shape AS (
    SELECT e.id,
           max(a.type) FILTER (WHERE jl.dc = 'debit')  AS debit_type,
           max(a.type) FILTER (WHERE jl.dc = 'credit') AS credit_type
    FROM entries e
    JOIN journal_lines jl ON jl.entry_id = e.id
    JOIN accounts a       ON a.id = jl.account_id
    WHERE e.deleted_at IS NULL
    GROUP BY e.id
)
SELECT
    CASE
        WHEN debit_type = 'expense'                                   THEN 'out'
        WHEN credit_type = 'income'                                   THEN 'in'
        WHEN debit_type IN ('asset','liability')
         AND credit_type IN ('asset','liability')                     THEN 'move'
        ELSE 'other'
    END AS mode,
    count(*)                                                          AS entries,
    round(100.0 * count(*) / sum(count(*)) OVER (), 1)                AS pct
FROM shape
GROUP BY 1
ORDER BY entries DESC;

\echo ''
\echo '=== 3. Category concentration: does the rail need to show more than a few? ==='
-- A fat tail means the rail is hiding the common case behind "add".
SELECT
    a.name                                             AS category,
    count(*)                                           AS entries,
    round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct,
    round(100.0 * sum(count(*)) OVER (ORDER BY count(*) DESC
        ROWS UNBOUNDED PRECEDING) / sum(count(*)) OVER (), 1) AS cumulative_pct
FROM entries e
JOIN journal_lines jl ON jl.entry_id = e.id AND jl.dc = 'debit'
JOIN accounts a       ON a.id = jl.account_id AND a.type = 'expense'
WHERE e.deleted_at IS NULL
GROUP BY a.name
ORDER BY entries DESC
LIMIT 15;

\echo ''
\echo '=== 4. Source pocket concentration: is remembering the last pocket enough? ==='
-- entry-new remembers one pocket per mode; only correct if one dominates.
SELECT
    a.name                                             AS pocket,
    count(*)                                           AS entries,
    round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM entries e
JOIN journal_lines jl ON jl.entry_id = e.id AND jl.dc = 'credit'
JOIN accounts a       ON a.id = jl.account_id AND a.type IN ('asset','liability')
WHERE e.deleted_at IS NULL
GROUP BY a.name
ORDER BY entries DESC;

\echo ''
\echo '=== 5. Backdating: does the date chip need to be on the first screen? ==='
-- All same-day means the date chip belongs folded behind details.
SELECT
    (e.created_at AT TIME ZONE 'UTC')::date - e.txn_date AS days_late,
    count(*)                                             AS entries,
    round(100.0 * count(*) / sum(count(*)) OVER (), 1)   AS pct
FROM entries e
WHERE e.deleted_at IS NULL
GROUP BY 1
ORDER BY 1
LIMIT 15;

\echo ''
\echo '=== 6. Memo and multi-currency: which optional fields actually get used? ==='
SELECT
    count(*)                                                    AS entries,
    count(*) FILTER (WHERE memo IS NOT NULL AND memo <> '')     AS with_memo,
    count(*) FILTER (WHERE fx_rate IS NOT NULL)                 AS cross_currency,
    count(*) FILTER (WHERE source = 'recurring')                AS from_recurring,
    count(DISTINCT currency)                                    AS distinct_currencies
FROM entries
WHERE deleted_at IS NULL;

\echo ''
\echo '=== 7. Capture rhythm: when is the app actually opened? ==='
-- Bursts mean batch entry at day end; an even spread means capture in the moment.
SELECT
    extract(hour FROM created_at AT TIME ZONE 'UTC')::int AS hour_utc,
    count(*)                                              AS entries
FROM entries
WHERE deleted_at IS NULL
GROUP BY 1
ORDER BY 1;
