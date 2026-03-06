-- V2: Performance Indexes and Syntax Fixes
-- Run this script in the Supabase SQL Editor

-- 1. Create essential indexes for fast date filtering
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_barcode ON daily_sales(barcode);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date_barcode ON daily_sales(date, barcode);

-- 2. Update Functions
CREATE OR REPLACE FUNCTION get_dashboard_metrics(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
    
    d_yesterday DATE := anchor_date - integer '1';
    
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_prev_week DATE := start_of_week - integer '7';
    
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
BEGIN
    SELECT json_build_object(
        'statYesterday', COALESCE(SUM(quantity) FILTER (WHERE date = anchor_date), 0),
        'fcYesterday', COALESCE(SUM(fc_quantity) FILTER (WHERE date = anchor_date), 0),
        'vfYesterday', COALESCE(SUM(vf_quantity) FILTER (WHERE date = anchor_date), 0),
        'statYesterdayPrevYear', COALESCE(SUM(quantity) FILTER (WHERE date = anchor_date - integer '364'), 0),
        
        'statWeekly', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'fcWeekly', COALESCE(SUM(fc_quantity) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'vfWeekly', COALESCE(SUM(vf_quantity) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'statWeeklyPrevYear', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_week - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'statMonthly', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_month AND date <= anchor_date), 0),
        'statMonthlyPrevYear', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_month - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'statYearly', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'statYearlyPrevYear', COALESCE(SUM(quantity) FILTER (WHERE date >= start_of_year - integer '364' AND date <= anchor_date - integer '364'), 0)
    ) INTO result
    FROM daily_sales
    WHERE date >= start_of_year - integer '364' 
      AND date <= anchor_date;

    RETURN result;
END;
$$;

-- Get daily trend (last 30 days) and weekly trend (last 12 weeks)
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
        SELECT 
            q1.date AS dateStr,
            q1.qty AS qty,
            (SELECT COALESCE(SUM(quantity), 0) FROM daily_sales WHERE date = q1.date - integer '364') as prev_qty
        FROM (
            SELECT 
                d.date,
                SUM(d.quantity) as qty
            FROM daily_sales d
            WHERE d.date > anchor_date - integer '30' AND d.date <= anchor_date
            GROUP BY d.date
        ) q1
        ORDER BY q1.date
    ) t;

    -- Weekly (Last 12 Weeks)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.fri_date,
        'quantity', t.qty,
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO weekly_trends
    FROM (
        SELECT 
            q2.fri_date as fri_date,
            q2.qty as qty,
            (SELECT COALESCE(SUM(quantity), 0) FROM daily_sales WHERE date >= q2.fri_date - integer '364' AND date <= q2.fri_date - integer '364' + integer '6') as prev_qty
        FROM (
            SELECT 
                (d.date - ((EXTRACT(DOW FROM d.date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(d.quantity) as qty
            FROM daily_sales d
            WHERE d.date > anchor_date - integer '84' AND d.date <= anchor_date
            GROUP BY (d.date - ((EXTRACT(DOW FROM d.date) + 2) % 7)::INTEGER)::DATE
        ) q2
        ORDER BY q2.fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;

-- Aggregate by product for product stats and rankings
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
