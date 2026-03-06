-- V4: Bypassing PostgREST timeouts and fixing JOIN syntax
-- Please run this in Supabase SQL Editor

-- 1. get_dashboard_metrics
CREATE OR REPLACE FUNCTION get_dashboard_metrics(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
SET statement_timeout TO '15s' -- Force this function to run up to 15 seconds instead of 3s PostgREST default
AS $$
DECLARE
    result json;
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
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
        WHERE date >= start_of_year - integer '364' AND date <= anchor_date
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


-- 2. get_dashboard_trends
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
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO daily_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '30' AND date <= anchor_date)
               OR (date > anchor_date - integer '30' - integer '364' AND date <= anchor_date - integer '364')
            GROUP BY date
        )
        SELECT 
            c.date AS dateStr,
            c.qty AS qty,
            COALESCE(p.qty, 0) AS prev_qty
        FROM raw_aggs c
        LEFT JOIN raw_aggs p ON p.date = c.date - integer '364'
        WHERE c.date > anchor_date - integer '30' AND c.date <= anchor_date
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
        )
        SELECT 
            c.fri_date,
            c.total_qty AS qty,
            COALESCE(p.total_qty, 0) AS prev_qty
        FROM weekly_aggs_current c
        LEFT JOIN weekly_aggs_prev p ON p.fri_date = c.fri_date - integer '364'
        ORDER BY c.fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;


-- 3. get_product_sales_stats
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
) LANGUAGE plpgsql
SET statement_timeout TO '15s' 
AS $$
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
    WHERE d.date >= start_of_year - integer '60'
    GROUP BY d.barcode;
END;
$$;
