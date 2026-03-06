-- V8: Fix type mismatch (NUMERIC vs BIGINT)
-- SUM() returns NUMERIC, but the function definition expects BIGINT.
-- Please run this in Supabase SQL Editor

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
    fc_qty_year BIGINT,
    vf_qty_year BIGINT,
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
    WITH daily_consolidated AS (
        SELECT 
            ds.barcode,
            ds.date,
            SUM(ds.quantity) as qty,
            SUM(ds.fc_quantity) as fc_qty,
            SUM(ds.vf_quantity) as vf_qty,
            MAX(ds.stock) as daily_stock_val
        FROM daily_sales ds
        WHERE ds.date >= start_of_year - integer '400'
        GROUP BY ds.barcode, ds.date
    )
    SELECT 
        c.barcode,
        SUM(c.qty) FILTER (WHERE c.date = anchor_date)::BIGINT AS qty_yesterday,
        SUM(c.fc_qty) FILTER (WHERE c.date = anchor_date)::BIGINT AS fc_qty_yesterday,
        SUM(c.vf_qty) FILTER (WHERE c.date = anchor_date)::BIGINT AS vf_qty_yesterday,
        SUM(c.qty) FILTER (WHERE c.date = anchor_date - integer '1')::BIGINT AS qty_yesterday_prev_day,
        SUM(c.qty) FILTER (WHERE c.date >= start_of_week AND c.date <= anchor_date)::BIGINT AS qty_week,
        SUM(c.qty) FILTER (WHERE c.date >= start_of_week - integer '7' AND c.date < start_of_week)::BIGINT AS qty_week_prev_week,
        SUM(c.qty) FILTER (WHERE c.date >= start_of_month AND c.date <= anchor_date)::BIGINT AS qty_month,
        SUM(c.qty) FILTER (WHERE c.date >= start_of_prev_month AND c.date <= end_of_prev_month)::BIGINT AS qty_month_prev_month,
        SUM(c.qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date)::BIGINT AS qty_year,
        SUM(c.fc_qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date)::BIGINT AS fc_qty_year,
        SUM(c.vf_qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date)::BIGINT AS vf_qty_year,
        SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '13' AND c.date <= anchor_date)::BIGINT AS qty_14d,
        SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '6' AND c.date <= anchor_date)::BIGINT AS qty_7d,
        SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '29' AND c.date <= anchor_date)::BIGINT AS qty_30d,
        SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '59' AND c.date <= anchor_date)::BIGINT AS qty_60d,
        
        json_object_agg(c.date::TEXT, COALESCE(c.qty, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date) AS daily_sales,
        json_object_agg(c.date::TEXT, COALESCE(c.daily_stock_val, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date AND c.daily_stock_val IS NOT NULL) AS daily_stock
    FROM daily_consolidated c
    GROUP BY c.barcode;
END;
$$;
