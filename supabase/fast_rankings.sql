-- [FAST] Dashboard Ranking Optimization (V4)
-- This function is highly optimized for the 100 top bestsellers.
-- It avoids slow nested joins for all products by filtering early.

CREATE OR REPLACE FUNCTION get_dashboard_rankings_fast(
    start_0 DATE,
    end_0 DATE,
    start_1 DATE,
    end_1 DATE,
    start_2 DATE,
    end_2 DATE,
    limit_val INTEGER DEFAULT 100
)
RETURNS TABLE (
    name TEXT,
    image_url TEXT,
    cost NUMERIC,
    qty_0y BIGINT,
    qty_1y BIGINT,
    qty_2y BIGINT,
    trend BIGINT
) LANGUAGE plpgsql
SET statement_timeout TO '10s'
AS $$
BEGIN
    RETURN QUERY
    WITH current_top AS (
        -- Step 1: Identify top barcodes for the primary date range first (Fast Scan)
        SELECT 
            ds.barcode,
            SUM(ds.quantity)::BIGINT as q0
        FROM daily_sales ds
        WHERE ds.date >= start_0 AND ds.date <= end_0
        GROUP BY ds.barcode
        ORDER BY q0 DESC
        LIMIT limit_val * 2 -- Buffer for grouping by name
    ),
    historical_sales AS (
        -- Step 2: Only scan historical data for these TOP barcodes
        SELECT 
            ds.barcode,
            CASE 
                WHEN ds.date >= start_0 AND ds.date <= end_0 THEN 0
                WHEN ds.date >= start_1 AND ds.date <= end_1 THEN 1
                WHEN ds.date >= start_2 AND ds.date <= end_2 THEN 2
            END as year_idx,
            ds.quantity
        FROM daily_sales ds
        JOIN current_top ct ON ct.barcode = ds.barcode
        WHERE (ds.date >= start_0 AND ds.date <= end_0)
           OR (ds.date >= start_1 AND ds.date <= end_1)
           OR (ds.date >= start_2 AND ds.date <= end_2)
    ),
    barcode_agg AS (
        -- Step 3: Fast aggregation
        SELECT 
            hs.barcode,
            COALESCE(SUM(hs.quantity) FILTER (WHERE hs.year_idx = 0), 0)::BIGINT AS q0,
            COALESCE(SUM(hs.quantity) FILTER (WHERE hs.year_idx = 1), 0)::BIGINT AS q1,
            COALESCE(SUM(hs.quantity) FILTER (WHERE hs.year_idx = 2), 0)::BIGINT AS q2
        FROM historical_sales hs
        GROUP BY hs.barcode
    )
    SELECT 
        COALESCE(p.name, ba.barcode) as name,
        MAX(p.image_url) as image_url,
        COALESCE(MAX(p.cost), 0)::NUMERIC as cost,
        SUM(ba.q0)::BIGINT as qty_0y,
        SUM(ba.q1)::BIGINT as qty_1y,
        SUM(ba.q2)::BIGINT as qty_2y,
        (SUM(ba.q0) - SUM(ba.q1))::BIGINT as trend
    FROM barcode_agg ba
    LEFT JOIN products p ON p.barcode = ba.barcode
    GROUP BY 1
    ORDER BY qty_0y DESC, name
    LIMIT limit_val;
END;
$$;

-- IMPORTANT: Ensure index exists for performance
-- CREATE INDEX IF NOT EXISTS idx_daily_sales_date_qty ON daily_sales(date, quantity);
