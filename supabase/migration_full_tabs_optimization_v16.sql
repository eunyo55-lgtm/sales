-- 1. Ultra-High Performance Product Stats RPC (V16)
CREATE OR REPLACE FUNCTION get_product_stats_v16(
    anchor_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    barcode text,
    name text,
    option_value text,
    season text,
    image_url text,
    hq_stock integer,
    current_stock integer,
    fc_stock integer,
    vf_stock integer,
    incoming_stock integer,
    cost numeric,
    qty_yesterday bigint,
    qty_7d bigint,
    qty_14d bigint,
    qty_30d bigint,
    qty_year bigint,
    avg_daily_sales numeric,
    abc_grade text,
    trend text,
    daily_sales_json jsonb
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH daily_sales_agg AS (
        SELECT 
            ds.barcode,
            jsonb_object_agg(ds.date::text, ds.quantity) as sales_map
        FROM daily_sales ds
        WHERE ds.date > anchor_date - interval '14 days' AND ds.date <= anchor_date
        GROUP BY ds.barcode
    ),
    prod_sales_totals AS (
        SELECT 
            ds.barcode,
            SUM(CASE WHEN ds.date = anchor_date THEN ds.quantity ELSE 0 END) as q_yest,
            SUM(CASE WHEN ds.date > anchor_date - interval '7 days' AND ds.date <= anchor_date THEN ds.quantity ELSE 0 END) as q_7d,
            SUM(CASE WHEN ds.date > anchor_date - interval '14 days' AND ds.date <= anchor_date THEN ds.quantity ELSE 0 END) as q_14d,
            SUM(CASE WHEN ds.date > anchor_date - interval '30 days' AND ds.date <= anchor_date THEN ds.quantity ELSE 0 END) as q_30d,
            SUM(CASE WHEN ds.date >= date_trunc('year', anchor_date) AND ds.date <= anchor_date THEN ds.quantity ELSE 0 END) as q_year
        FROM daily_sales ds
        WHERE ds.date > anchor_date - interval '30 days' OR ds.date >= date_trunc('year', anchor_date)
        GROUP BY ds.barcode
    ),
    stats AS (
        SELECT 
            p.barcode,
            p.name,
            p.option_value,
            p.season,
            p.image_url,
            COALESCE(p.hq_stock, 0) as hq_s,
            COALESCE(p.current_stock, 0) as cur_s,
            COALESCE(p.fc_stock, 0) as fc_s,
            COALESCE(p.vf_stock, 0) as vf_s,
            COALESCE(p.incoming_stock, 0) as inc_s,
            COALESCE(p.cost, 0) as p_cost,
            COALESCE(ps.q_yest, 0) as q_yest,
            COALESCE(ps.q_7d, 0) as q_7d,
            COALESCE(ps.q_14d, 0) as q_14d,
            COALESCE(ps.q_30d, 0) as q_30d,
            COALESCE(ps.q_year, 0) as q_year,
            ROUND((COALESCE(ps.q_7d, 0) / 7.0)::numeric, 2) as ads,
            COALESCE(dsa.sales_map, '{}'::jsonb) as sales_json
        FROM products p
        LEFT JOIN prod_sales_totals ps ON p.barcode = ps.barcode
        LEFT JOIN daily_sales_agg dsa ON p.barcode = dsa.barcode
    ),
    abc AS (
        SELECT 
            *,
            CASE 
                WHEN q_7d >= 100 THEN 'A'
                WHEN q_7d >= 30 THEN 'B'
                WHEN q_7d >= 5 THEN 'C'
                ELSE 'D'
            END as grade,
            CASE 
                WHEN q_7d > (q_14d - q_7d) * 1.5 THEN 'hot'
                WHEN q_7d < (q_14d - q_7d) * 0.5 THEN 'cold'
                WHEN q_7d > (q_14d - q_7d) THEN 'up'
                WHEN q_7d < (q_14d - q_7d) THEN 'down'
                ELSE 'flat'
            END as tr
        FROM stats
    )
    SELECT 
        barcode, name, option_value, season, image_url, 
        hq_s, cur_s, fc_s, vf_s, inc_s, p_cost,
        q_yest, q_7d, q_14d, q_30d, q_year, ads, grade, tr, sales_json
    FROM abc;
END;
$$;
