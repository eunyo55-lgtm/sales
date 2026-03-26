-- Supabase Migration for Custom Date Range Rankings (Optimized V3 Final)
-- This version performs JOIN and GROUP BY in the database to prevent frontend timeouts.
-- It returns product names directly, handling multiple barcodes for the same product.

CREATE OR REPLACE FUNCTION get_dashboard_combined_rankings_custom(
    start_date DATE,
    end_date DATE,
    limit_val INTEGER DEFAULT 1000,
    offset_val INTEGER DEFAULT 0
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
SET statement_timeout TO '30s'
AS $$
DECLARE
    -- Dates (Year 0)
    start_0 DATE := start_date;
    end_0 DATE := end_date;
    -- Dates (Year 1)
    start_1 DATE := start_0 - integer '364';
    end_1 DATE := end_0 - integer '364';
    -- Dates (Year 2)
    start_2 DATE := start_0 - integer '728';
    end_2 DATE := end_0 - integer '728';
BEGIN
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
    ),
    barcode_agg AS (
        SELECT 
            ts.barcode,
            COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 0), 0)::BIGINT AS q0,
            COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 1), 0)::BIGINT AS q1,
            COALESCE(SUM(ts.quantity) FILTER (WHERE ts.year_idx = 2), 0)::BIGINT AS q2
        FROM target_sales ts
        GROUP BY ts.barcode
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
    HAVING SUM(ba.q0 + ba.q1 + ba.q2) > 0
    ORDER BY qty_0y DESC, name
    LIMIT limit_val OFFSET offset_val;
END;
$$;
