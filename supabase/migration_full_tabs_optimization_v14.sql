-- 1. Optimized Product Stats RPC (V14)
-- Returns the full list of products with all aggregated metrics calculated in SQL.
CREATE OR REPLACE FUNCTION get_product_stats_v14(
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
    trend text
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH prod_sales AS (
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
            ROUND((COALESCE(ps.q_7d, 0) / 7.0)::numeric, 2) as ads
        FROM products p
        LEFT JOIN prod_sales ps ON p.barcode = ps.barcode
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
        q_yest, q_7d, q_14d, q_30d, q_year, ads, grade, tr
    FROM abc;
END;
$$;

-- 2. Optimized Supply Analytics RPC (V14)
-- Returns pre-aggregated timeline and performance data for SupplyStatus.
CREATE OR REPLACE FUNCTION get_supply_analytics_v14(
    history_months integer DEFAULT 24
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
    timeline_json json;
    performance_json json;
    incoming_data_json json;
BEGIN
    -- Group orders by custom week (Friday to Thursday) or Month
    -- Note: Week starts on Friday logic
    WITH order_base AS (
        SELECT 
            o.*,
            p.name as prod_name,
            p.image_url as prod_image,
            COALESCE(p.cost, 0) as prod_cost,
            (o.order_qty * o.unit_cost) as order_amt,
            (o.confirmed_qty * o.unit_cost) as confirmed_amt,
            (o.received_qty * o.unit_cost) as received_amt,
            -- Week key calculation (Friday is day 5)
            -- Friday - Friday + 7
            (order_date - ((extract(dow from order_date)::int + 2) % 7))::date as week_start
        FROM coupang_orders o
        LEFT JOIN products p ON o.barcode = p.barcode
        WHERE o.order_date >= CURRENT_DATE - (history_months || ' months')::interval
    ),
    weekly_summary AS (
        SELECT 
            week_start::text || ' ~ ' || (week_start + 6)::text as key,
            SUM(order_qty) as "orderQty",
            SUM(confirmed_qty) as "confirmedQty",
            SUM(received_qty) as "receivedQty",
            SUM(order_amt) as "orderAmount",
            SUM(confirmed_amt) as "confirmedAmount",
            SUM(received_amt) as "receivedAmount"
        FROM order_base
        GROUP BY week_start
        ORDER BY week_start DESC
    ),
    prod_performance AS (
        SELECT 
            prod_name as name,
            prod_image as image,
            SUM(order_qty) as "orderQty",
            SUM(confirmed_qty) as "confirmedQty",
            SUM(received_qty) as "receivedQty",
            SUM(order_amt) as "orderAmount",
            SUM(confirmed_amt) as "confirmedAmount",
            SUM(received_amt) as "receivedAmount"
        FROM order_base
        GROUP BY prod_name, prod_image
        HAVING SUM(order_qty) > 0
    )
    SELECT json_agg(w) INTO timeline_json FROM weekly_summary w;
    SELECT json_agg(p) INTO performance_json FROM prod_performance p;

    RETURN json_build_object(
        'timeline', COALESCE(timeline_json, '[]'::json),
        'performance', COALESCE(performance_json, '[]'::json)
    );
END;
$$;
