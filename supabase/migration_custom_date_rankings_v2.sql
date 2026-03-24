-- Supabase Migration for Custom Date Range Rankings

CREATE OR REPLACE FUNCTION get_dashboard_combined_rankings_custom(
    start_date DATE,
    end_date DATE
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
