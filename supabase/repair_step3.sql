-- STEP 3: Restore Dashboard Trends Function
CREATE OR REPLACE FUNCTION get_dashboard_trends(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
SET statement_timeout TO '15s'
AS $$
DECLARE
    daily_trends json;
    weekly_trends json;
BEGIN
    -- Daily (Last 30 Days)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.dateStr,
        'sales', t.qty,
        'prevYearQuantity', t.prev_qty,
        'prev2YearQuantity', t.prev2_qty
    )), '[]'::json) INTO daily_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '30' AND date <= anchor_date)
               OR (date > anchor_date - integer '30' - integer '364' AND date <= anchor_date - integer '364')
               OR (date > anchor_date - integer '30' - integer '728' AND date <= anchor_date - integer '728')
            GROUP BY date
        )
        SELECT 
            c.date AS dateStr,
            c.qty AS qty,
            COALESCE(p.qty, 0) AS prev_qty,
            COALESCE(pp.qty, 0) AS prev2_qty
        FROM raw_aggs c
        LEFT JOIN raw_aggs p ON p.date = c.date - integer '364'
        LEFT JOIN raw_aggs pp ON pp.date = c.date - integer '728'
        WHERE c.date > anchor_date - integer '30' AND c.date <= anchor_date
        ORDER BY c.date
    ) t;

    -- Weekly (Last 12 Weeks)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.fri_date,
        'sales', t.qty,
        'prevYearQuantity', t.prev_qty,
        'prev2YearQuantity', t.prev2_qty
    )), '[]'::json) INTO weekly_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '84' AND date <= anchor_date)
               OR (date >= anchor_date - integer '84' - integer '364' - integer '7' AND date <= anchor_date - integer '364' + integer '7')
               OR (date >= anchor_date - integer '84' - integer '728' - integer '7' AND date <= anchor_date - integer '728' + integer '7')
            GROUP BY date
        ),
        weekly_aggs_current AS (
            SELECT 
                (date - ((EXTRACT(DOW FROM date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(qty) as total_qty
            FROM raw_aggs
            WHERE date > anchor_date - integer '84' AND date <= anchor_date
            GROUP BY 1
        ),
        weekly_aggs_prev AS (
            SELECT 
                (date - ((EXTRACT(DOW FROM date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(qty) as total_qty
            FROM raw_aggs
            WHERE date >= anchor_date - integer '84' - integer '364' - integer '7' 
              AND date <= anchor_date - integer '364' + integer '7'
            GROUP BY 1
        ),
        weekly_aggs_prev2 AS (
            SELECT 
                (date - ((EXTRACT(DOW FROM date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(qty) as total_qty
            FROM raw_aggs
            WHERE date >= anchor_date - integer '84' - integer '728' - integer '7' 
              AND date <= anchor_date - integer '728' + integer '7'
            GROUP BY 1
        )
        SELECT 
            c.fri_date,
            c.total_qty AS qty,
            COALESCE(p.total_qty, 0) AS prev_qty,
            COALESCE(pp.total_qty, 0) AS prev2_qty
        FROM weekly_aggs_current c
        LEFT JOIN weekly_aggs_prev p ON p.fri_date = c.fri_date - integer '364'
        LEFT JOIN weekly_aggs_prev2 pp ON pp.fri_date = c.fri_date - integer '728'
        ORDER BY c.fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;
