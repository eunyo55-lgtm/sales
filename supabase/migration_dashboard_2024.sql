-- Supabase Migration for 2024 Data Support (3-Year Dashboard)

-- 1. Update get_dashboard_trends to support 3 years (-0, -364, -728 days)
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
        'quantity', t.qty,
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
            COALESCE(c.qty, 0) AS qty,
            COALESCE(p1.qty, 0) AS prev_qty,
            COALESCE(p2.qty, 0) AS prev2_qty
        FROM raw_aggs c
        LEFT JOIN raw_aggs p1 ON p1.date = c.date - integer '364'
        LEFT JOIN raw_aggs p2 ON p2.date = c.date - integer '728'
        WHERE c.date > anchor_date - integer '30' AND c.date <= anchor_date
        ORDER BY c.date
    ) t;

    -- Weekly (Last 12 Weeks)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.fri_date,
        'quantity', t.qty,
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
        weekly_aggs_prev1 AS (
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
            COALESCE(c.total_qty, 0) AS qty,
            COALESCE(p1.total_qty, 0) AS prev_qty,
            COALESCE(p2.total_qty, 0) AS prev2_qty
        FROM weekly_aggs_current c
        LEFT JOIN weekly_aggs_prev1 p1 ON p1.fri_date = c.fri_date - integer '364'
        LEFT JOIN weekly_aggs_prev2 p2 ON p2.fri_date = c.fri_date - integer '728'
        ORDER BY c.fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;


-- 2. New RPC: get_dashboard_combined_rankings
-- Fetches the 3-year aggregated quantity for a specific period
CREATE OR REPLACE FUNCTION get_dashboard_combined_rankings(
    anchor_date DATE,
    period_type TEXT -- 'daily', 'weekly', 'yearly'
)
RETURNS TABLE (
    barcode TEXT,
    qty_0y BIGINT,
    qty_1y BIGINT,
    qty_2y BIGINT,
    trend BIGINT
) LANGUAGE plpgsql
SET statement_timeout TO '30s'
AS $$
DECLARE
    -- Dates (Year 0)
    start_0 DATE;
    end_0 DATE;
    -- Dates (Year 1)
    start_1 DATE;
    end_1 DATE;
    -- Dates (Year 2)
    start_2 DATE;
    end_2 DATE;
BEGIN
    IF period_type = 'daily' THEN
        -- Year 0
        start_0 := anchor_date;
        end_0 := anchor_date;
        -- Year 1
        start_1 := anchor_date - integer '364';
        end_1 := anchor_date - integer '364';
        -- Year 2
        start_2 := anchor_date - integer '728';
        end_2 := anchor_date - integer '728';

    ELSIF period_type = 'weekly' THEN
        -- Standard Friday-to-Thursday week matching anchor_date
        -- It calculates the closest past Friday
        start_0 := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
        end_0 := anchor_date;
        -- Year 1
        start_1 := start_0 - integer '364';
        end_1 := anchor_date - integer '364';
        -- Year 2
        start_2 := start_0 - integer '728';
        end_2 := anchor_date - integer '728';

    ELSIF period_type = 'yearly' THEN
        -- Year 0 (Current year to date)
        start_0 := date_trunc('year', anchor_date)::DATE;
        end_0 := anchor_date;
        -- Year 1
        start_1 := date_trunc('year', anchor_date - interval '1 year')::DATE;
        end_1 := (anchor_date - interval '1 year')::DATE;
        -- Year 2
        start_2 := date_trunc('year', anchor_date - interval '2 years')::DATE;
        end_2 := (anchor_date - interval '2 years')::DATE;
    ELSE
        -- Default to daily if invalid
        start_0 := anchor_date; end_0 := anchor_date;
        start_1 := anchor_date - integer '364'; end_1 := anchor_date - integer '364';
        start_2 := anchor_date - integer '728'; end_2 := anchor_date - integer '728';
    END IF;

    RETURN QUERY
    WITH target_sales AS (
        SELECT 
            ds.barcode,
            CASE 
                WHEN ds.date >= start_0 AND ds.date <= end_0 THEN 0
                WHEN ds.date >= start_1 AND ds.date <= end_1 THEN 1
                WHEN ds.date >= start_2 AND ds.date <= end_2 THEN 2
                ELSE NULL
            END as year_idx,
            ds.quantity
        FROM daily_sales ds
        WHERE (ds.date >= start_0 AND ds.date <= end_0)
           OR (ds.date >= start_1 AND ds.date <= end_1)
           OR (ds.date >= start_2 AND ds.date <= end_2)
    )
    SELECT 
        ts.barcode,
        COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 0), 0)::BIGINT AS qty_0y,
        COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 1), 0)::BIGINT AS qty_1y,
        COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 2), 0)::BIGINT AS qty_2y,
        (COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 0), 0) - COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 1), 0))::BIGINT AS trend
    FROM target_sales ts
    GROUP BY ts.barcode
    HAVING SUM(ts.quantity) > 0;
END;
$$;
