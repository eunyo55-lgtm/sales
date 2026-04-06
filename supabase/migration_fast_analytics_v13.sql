-- V13: Restore full-year data and optimize result set
-- CREATE get_dashboard_summary to replace slow client-side aggregation

DROP FUNCTION IF EXISTS get_dashboard_summary(DATE);

CREATE OR REPLACE FUNCTION get_dashboard_summary(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
SET statement_timeout TO '30s'
AS $$
DECLARE
    result json;
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
    
    -- Prior Date for stock comparison
    prior_date DATE;
    
    -- Stock Metrics
    total_stock BIGINT;
    total_fc_stock BIGINT;
    total_vf_stock BIGINT;
    total_stock_prev_day BIGINT;
    total_stock_amount BIGINT;
    
    -- Aggregated Sales Metrics
    metrics_json json;
    risk_items_json json;
    avg_cost_val NUMERIC;
BEGIN
    -- 1. Find Prior Date
    SELECT date INTO prior_date
    FROM daily_sales
    WHERE date < anchor_date
    ORDER BY date DESC
    LIMIT 1;

    -- 2. Calculate Stock Metrics (Current) & Avg Cost
    SELECT 
        SUM(ds.stock),
        SUM(ds.fc_quantity), 
        SUM(ds.vf_quantity),
        SUM(ds.stock * COALESCE(p.cost, 0)),
        AVG(p.cost) FILTER (WHERE p.cost > 0)
    INTO total_stock, total_fc_stock, total_vf_stock, total_stock_amount, avg_cost_val
    FROM daily_sales ds
    LEFT JOIN products p ON ds.barcode = p.barcode
    WHERE ds.date = anchor_date;

    -- 3. Calculate Stock Metrics (Prev Day)
    IF prior_date IS NOT NULL THEN
        SELECT SUM(stock) INTO total_stock_prev_day
        FROM daily_sales
        WHERE date = prior_date;
    ELSE
        total_stock_prev_day := 0;
    END IF;

    -- 4. Calculate Sales Metrics with Cost Join
    WITH daily_aggs AS (
        SELECT 
            ds.date,
            SUM(ds.quantity) as qty,
            SUM(ds.fc_quantity) as fc_qty,
            SUM(ds.vf_quantity) as vf_qty,
            SUM(ds.quantity * COALESCE(p.cost, 0)) as amt
        FROM daily_sales ds
        LEFT JOIN products p ON ds.barcode = p.barcode
        WHERE ds.date >= start_of_year - integer '366' AND ds.date <= anchor_date
        GROUP BY ds.date
    )
    SELECT json_build_object(
        'yesterday', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date), 0),
        'yesterdayAmount', COALESCE(SUM(amt) FILTER (WHERE date = anchor_date), 0),
        'fcYesterday', COALESCE(SUM(fc_qty) FILTER (WHERE date = anchor_date), 0),
        'vfYesterday', COALESCE(SUM(vf_qty) FILTER (WHERE date = anchor_date), 0),
        'yesterdayPrevYear', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date - integer '364'), 0),
        
        'weekly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'weeklyAmount', COALESCE(SUM(amt) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'fcWeekly', COALESCE(SUM(fc_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'vfWeekly', COALESCE(SUM(vf_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'weeklyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'monthly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_month AND date <= anchor_date), 0),
        'monthlyAmount', COALESCE(SUM(amt) FILTER (WHERE date >= start_of_month AND date <= anchor_date), 0),
        'monthlyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_month - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'yearly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'yearlyAmount', COALESCE(SUM(amt) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'fcYearly', COALESCE(SUM(fc_qty) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'vfYearly', COALESCE(SUM(vf_qty) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'yearlyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year - integer '364' AND date <= anchor_date - integer '364'), 0)
    ) INTO metrics_json
    FROM daily_aggs;

    -- 5. Calculate Risk Items (Inventory < 3 days of avg 7d sales)
    WITH product_sales7d AS (
        SELECT 
            p.name,
            p.image_url,
            SUM(ds.quantity) as qty_7d,
            MAX(ds.stock) FILTER (WHERE ds.date = anchor_date) as current_stock
        FROM daily_sales ds
        JOIN products p ON ds.barcode = p.barcode
        WHERE ds.date > anchor_date - interval '7 days' AND ds.date <= anchor_date
        GROUP BY p.name, p.image_url
    )
    SELECT json_agg(json_build_object(
        'name', name,
        'imageUrl', image_url,
        'currentStock', current_stock,
        'avgDailySales', ROUND((qty_7d / 7.0)::numeric, 1),
        'daysLeft', ROUND((current_stock / (NULLIF(qty_7d, 0) / 7.0))::numeric, 1)
    )) INTO risk_items_json
    FROM product_sales7d
    WHERE current_stock > 0 AND qty_7d > 0 AND (current_stock / (qty_7d / 7.0)) <= 3;

    -- 6. Combine and Return
    RETURN json_build_object(
        'metrics', metrics_json,
        'stock', json_build_object(
            'totalStock', COALESCE(total_stock, 0),
            'totalFcStock', COALESCE(total_fc_stock, 0),
            'totalVfStock', COALESCE(total_vf_stock, 0),
            'totalStockPrevDay', COALESCE(total_stock_prev_day, 0),
            'totalStockAmount', COALESCE(total_stock_amount, 0)
        ),
        'riskItems', COALESCE(risk_items_json, '[]'::json),
        'avgCost', COALESCE(avg_cost_val, 0)
    );
END;
$$;
