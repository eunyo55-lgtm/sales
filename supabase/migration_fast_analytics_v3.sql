-- V3: Single-pass CTEs to avoid PostgREST 3-second timeout
-- Please run this in Supabase SQL Editor

-- 1. get_dashboard_metrics (Rewrite to group by date first)
CREATE OR REPLACE FUNCTION get_dashboard_metrics(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
    
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_prev_week DATE := start_of_week - integer '7';
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
BEGIN
    WITH daily_aggs AS (
        SELECT 
            date,
            SUM(quantity) as qty,
            SUM(fc_quantity) as fc_qty,
            SUM(vf_quantity) as vf_qty
        FROM daily_sales
        -- Only fetch the exact required ranges to minimize rows scanned
        WHERE (date >= start_of_year - integer '364' AND date <= anchor_date)
        GROUP BY date
    )
    SELECT json_build_object(
        'statYesterday', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date), 0),
        'fcYesterday', COALESCE(SUM(fc_qty) FILTER (WHERE date = anchor_date), 0),
        'vfYesterday', COALESCE(SUM(vf_qty) FILTER (WHERE date = anchor_date), 0),
        'statYesterdayPrevYear', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date - integer '364'), 0),
        
        'statWeekly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'fcWeekly', COALESCE(SUM(fc_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'vfWeekly', COALESCE(SUM(vf_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'statWeeklyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'statMonthly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_month AND date <= anchor_date), 0),
        'statMonthlyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_month - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'statYearly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'statYearlyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year - integer '364' AND date <= anchor_date - integer '364'), 0)
    ) INTO result
    FROM daily_aggs;

    RETURN result;
END;
$$;

-- 2. get_dashboard_trends (Rewrite to use a single pass CTE for current and previous year)
CREATE OR REPLACE FUNCTION get_dashboard_trends(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    daily_trends json;
    weekly_trends json;
BEGIN
    -- Daily (Last 30 Days)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.dateStr,
        'quantity', t.qty,
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO daily_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            -- We need current year 30 days and prev year 30 days (approx)
            WHERE (date > anchor_date - integer '30' AND date <= anchor_date)
               OR (date > anchor_date - integer '30' - integer '364' AND date <= anchor_date - integer '364')
            GROUP BY date
        )
        SELECT 
            c.date AS dateStr,
            COALESCE(SUM(c.qty), 0) AS qty,
            COALESCE((SELECT SUM(qty) FROM raw_aggs p WHERE p.date = c.date - integer '364'), 0) AS prev_qty
        FROM raw_aggs c
        WHERE c.date > anchor_date - integer '30' AND c.date <= anchor_date
        GROUP BY c.date
        ORDER BY c.date
    ) t;

    -- Weekly (Last 12 Weeks)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.fri_date,
        'quantity', t.qty,
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO weekly_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '84' AND date <= anchor_date)
               OR (date >= anchor_date - integer '84' - integer '364' - integer '7' AND date <= anchor_date - integer '364' + integer '7')
            GROUP BY date
        )
        SELECT 
            (c.date - ((EXTRACT(DOW FROM c.date) + 2) % 7)::INTEGER)::DATE as fri_date,
            COALESCE(SUM(c.qty), 0) AS qty,
            -- Calculate previous year week by joining the pre-aggregated data
            COALESCE((
                SELECT SUM(qty) 
                FROM raw_aggs p 
                WHERE p.date >= (c.date - ((EXTRACT(DOW FROM c.date) + 2) % 7)::INTEGER) - integer '364' 
                  AND p.date <= (c.date - ((EXTRACT(DOW FROM c.date) + 2) % 7)::INTEGER) - integer '364' + integer '6'
            ), 0) AS prev_qty
        FROM raw_aggs c
        WHERE c.date > anchor_date - integer '84' AND c.date <= anchor_date
        GROUP BY (c.date - ((EXTRACT(DOW FROM c.date) + 2) % 7)::INTEGER)::DATE
        ORDER BY fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;

-- 3. Aggregate by product for product stats and rankings
-- This one is extremely fast already (1.7s) but let's ensure it doesn't timeout if it hits 3s
CREATE OR REPLACE FUNCTION get_product_sales_stats(anchor_date DATE)
RETURNS TABLE (
    barcode TEXT,
    qty_yesterday BIGINT,
    fc_qty_yesterday BIGINT,
    vf_qty_yesterday BIGINT,
    
    qty_yesterday_prev_day BIGINT,
    
    qty_week BIGINT,
    qty_week_prev_week BIGINT,
    
    qty_month BIGINT,
    qty_month_prev_month BIGINT,
    
    qty_year BIGINT,
    
    qty_14d BIGINT,
    qty_7d BIGINT,
    qty_30d BIGINT,
    qty_60d BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
    
    start_of_prev_month DATE := date_trunc('month', start_of_month - integer '1')::DATE;
    end_of_prev_month DATE := (start_of_month - integer '1')::DATE;
BEGIN
    RETURN QUERY
    SELECT 
        d.barcode,
        SUM(d.quantity) FILTER (WHERE d.date = anchor_date) AS qty_yesterday,
        SUM(d.fc_quantity) FILTER (WHERE d.date = anchor_date) AS fc_qty_yesterday,
        SUM(d.vf_quantity) FILTER (WHERE d.date = anchor_date) AS vf_qty_yesterday,
        
        SUM(d.quantity) FILTER (WHERE d.date = anchor_date - integer '1') AS qty_yesterday_prev_day,
        
        SUM(d.quantity) FILTER (WHERE d.date >= start_of_week AND d.date <= anchor_date) AS qty_week,
        SUM(d.quantity) FILTER (WHERE d.date >= start_of_week - integer '7' AND d.date < start_of_week) AS qty_week_prev_week,
        
        SUM(d.quantity) FILTER (WHERE d.date >= start_of_month AND d.date <= anchor_date) AS qty_month,
        SUM(d.quantity) FILTER (WHERE d.date >= start_of_prev_month AND d.date <= end_of_prev_month) AS qty_month_prev_month,
        
        SUM(d.quantity) FILTER (WHERE d.date >= start_of_year AND d.date <= anchor_date) AS qty_year,
        
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '13' AND d.date <= anchor_date) AS qty_14d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '6' AND d.date <= anchor_date) AS qty_7d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '29' AND d.date <= anchor_date) AS qty_30d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '59' AND d.date <= anchor_date) AS qty_60d
    FROM daily_sales d
    WHERE d.date >= start_of_year - integer '60' -- ensure it covers the maximum lookback
    GROUP BY d.barcode;
END;
$$;
