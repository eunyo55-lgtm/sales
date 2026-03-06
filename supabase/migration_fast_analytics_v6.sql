-- V6: Expand daily history to full year and add cumulative regional sales
-- Please run this in Supabase SQL Editor

-- Drop existing function to change return signature
DROP FUNCTION IF EXISTS get_product_sales_stats(DATE);

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
    fc_qty_year BIGINT, -- [NEW] Cumulative FC
    vf_qty_year BIGINT, -- [NEW] Cumulative VF
    
    qty_14d BIGINT,
    qty_7d BIGINT,
    qty_30d BIGINT,
    qty_60d BIGINT,
    
    daily_sales json,
    daily_stock json
) LANGUAGE plpgsql
SET statement_timeout TO '20s' 
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
        SUM(d.fc_quantity) FILTER (WHERE d.date >= start_of_year AND d.date <= anchor_date) AS fc_qty_year,
        SUM(d.vf_quantity) FILTER (WHERE d.date >= start_of_year AND d.date <= anchor_date) AS vf_qty_year,
        
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '13' AND d.date <= anchor_date) AS qty_14d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '6' AND d.date <= anchor_date) AS qty_7d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '29' AND d.date <= anchor_date) AS qty_30d,
        SUM(d.quantity) FILTER (WHERE d.date >= anchor_date - integer '59' AND d.date <= anchor_date) AS qty_60d,

        -- Expanded history: Start of Year to Anchor Date
        json_object_agg(d.date::TEXT, COALESCE(d.quantity, 0)) FILTER (WHERE d.date >= start_of_year AND d.date <= anchor_date) AS daily_sales,
        json_object_agg(d.date::TEXT, COALESCE(d.stock, 0)) FILTER (WHERE d.date >= start_of_year AND d.date <= anchor_date AND d.stock IS NOT NULL) AS daily_stock

    FROM daily_sales d
    WHERE d.date >= start_of_year - integer '400' -- include some buffer for prev year comparisons if needed
    GROUP BY d.barcode;
END;
$$;
