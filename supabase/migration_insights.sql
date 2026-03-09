-- Migration: get_dashboard_insights (V6 - Fix image naming)
-- Groups by Product Name and returns camelCase imageUrl for UI compatibility

DROP FUNCTION IF EXISTS get_dashboard_insights(DATE);

CREATE OR REPLACE FUNCTION get_dashboard_insights(
    anchor_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET statement_timeout TO '45s'
AS $$
DECLARE
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
    yoy_anchor_date DATE := anchor_date - integer '364';
    yoy_start_of_year DATE := (date_trunc('year', anchor_date) - interval '1 year')::DATE; 
    
    result JSONB;
BEGIN
    WITH current_year_sales AS (
        SELECT ds.barcode, SUM(ds.quantity) as total_qty
        FROM daily_sales ds
        WHERE ds.date >= start_of_year AND ds.date <= anchor_date
        GROUP BY ds.barcode
    ),
    prev_year_sales AS (
        SELECT ds.barcode, SUM(ds.quantity) as total_qty
        FROM daily_sales ds
        WHERE ds.date >= yoy_start_of_year AND ds.date <= yoy_anchor_date
        GROUP BY ds.barcode
    ),
    diffs_per_barcode AS (
        SELECT 
            COALESCE(c.barcode, p.barcode) as barcode,
            COALESCE(c.total_qty, 0) as curr_qty,
            COALESCE(p.total_qty, 0) as prev_qty,
            COALESCE(c.total_qty, 0) - COALESCE(p.total_qty, 0) as diff
        FROM current_year_sales c
        FULL OUTER JOIN prev_year_sales p ON c.barcode = p.barcode
    ),
    product_comparison AS (
        SELECT 
            TRIM(p.name) as name,
            -- Grouping by name: pick the first non-null image
            (ARRAY_AGG(p.image_url ORDER BY p.image_url DESC))[1] as "imageUrl",
            TRIM(COALESCE(NULLIF(p.season, ''), '정보없음')) as season,
            SUM(d.curr_qty)::BIGINT as curr_qty,
            SUM(d.prev_qty)::BIGINT as prev_qty,
            SUM(d.diff)::BIGINT as diff
        FROM diffs_per_barcode d
        JOIN products p ON d.barcode = p.barcode
        GROUP BY 1, 3
    ),
    top_winners AS (
        SELECT * FROM product_comparison 
        WHERE diff > 0
        ORDER BY diff DESC 
        LIMIT 10
    ),
    top_losers AS (
        SELECT * FROM product_comparison 
        WHERE diff < 0
        ORDER BY diff ASC 
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'winners', (SELECT jsonb_agg(w) FROM top_winners w),
        'losers', (SELECT jsonb_agg(l) FROM top_losers l)
    ) INTO result;

    RETURN result;
END;
$$;
