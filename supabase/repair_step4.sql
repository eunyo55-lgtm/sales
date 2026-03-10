-- STEP 4: Restore Product Sales Stats (Optimized)
CREATE OR REPLACE FUNCTION get_product_sales_stats(
    anchor_date DATE,
    limit_val INTEGER DEFAULT 1000,
    offset_val INTEGER DEFAULT 0
)
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
SET statement_timeout TO '45s' 
AS $$
DECLARE
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
    start_of_prev_month DATE := date_trunc('month', start_of_month - integer '1')::DATE;
    end_of_prev_month DATE := (start_of_month - integer '1')::DATE;
    min_date DATE := date_trunc('year', anchor_date)::DATE;
BEGIN
    RETURN QUERY
    WITH target_barcodes AS (
        SELECT p.barcode
        FROM products p
        ORDER BY p.barcode
        LIMIT limit_val OFFSET offset_val
    ),
    daily_consolidated AS (
        SELECT 
            ds.barcode,
            ds.date,
            SUM(ds.quantity) as qty,
            SUM(ds.fc_quantity) as fc_qty,
            SUM(ds.vf_quantity) as vf_qty,
            MAX(ds.stock) as daily_stock_val
        FROM daily_sales ds
        INNER JOIN target_barcodes tb ON ds.barcode = tb.barcode
        WHERE ds.date >= start_of_year - integer '7'
        GROUP BY ds.barcode, ds.date
    )
    SELECT 
        tb.barcode,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date = anchor_date), 0)::BIGINT AS qty_yesterday,
        COALESCE(SUM(c.fc_qty) FILTER (WHERE c.date = anchor_date), 0)::BIGINT AS fc_qty_yesterday,
        COALESCE(SUM(c.vf_qty) FILTER (WHERE c.date = anchor_date), 0)::BIGINT AS vf_qty_yesterday,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date = anchor_date - integer '1'), 0)::BIGINT AS qty_yesterday_prev_day,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= start_of_week AND c.date <= anchor_date), 0)::BIGINT AS qty_week,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= start_of_week - integer '7' AND c.date < start_of_week), 0)::BIGINT AS qty_week_prev_week,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= start_of_month AND c.date <= anchor_date), 0)::BIGINT AS qty_month,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= start_of_prev_month AND c.date <= end_of_prev_month), 0)::BIGINT AS qty_month_prev_month,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date), 0)::BIGINT AS qty_year,
        COALESCE(SUM(c.fc_qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date), 0)::BIGINT AS fc_qty_year,
        COALESCE(SUM(c.vf_qty) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date), 0)::BIGINT AS vf_qty_year,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '13' AND c.date <= anchor_date), 0)::BIGINT AS qty_14d,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '6' AND c.date <= anchor_date), 0)::BIGINT AS qty_7d,
        COALESCE(SUM(c.qty) FILTER (WHERE d.date >= anchor_date - integer '29' AND c.date <= anchor_date), 0)::BIGINT AS qty_30d, -- Corrected 'd.date' to 'c.date' here as well
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '59' AND c.date <= anchor_date), 0)::BIGINT AS qty_60d,
        json_object_agg(c.date::TEXT, COALESCE(c.qty, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date) AS daily_sales,
        json_object_agg(c.date::TEXT, COALESCE(c.daily_stock_val, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date AND c.daily_stock_val IS NOT NULL) AS daily_stock
    FROM target_barcodes tb
    LEFT JOIN daily_consolidated c ON tb.barcode = c.barcode
    GROUP BY tb.barcode;
END;
$$;
