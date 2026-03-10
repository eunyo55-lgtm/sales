-- 1. Restore daily_sales table
CREATE TABLE IF NOT EXISTS daily_sales (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    date date NOT NULL,
    barcode text REFERENCES products(barcode),
    quantity integer DEFAULT 0,
    fc_quantity integer DEFAULT 0,
    vf_quantity integer DEFAULT 0,
    stock integer DEFAULT 0,
    revenue integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(date, barcode)
);

-- 2. Enable RLS and Policies
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_sales" ON daily_sales;
CREATE POLICY "Allow all access to daily_sales" ON daily_sales FOR ALL USING (true) WITH CHECK (true);

-- 3. Restore Dashboard Metrics Function
CREATE OR REPLACE FUNCTION get_dashboard_metrics(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
SET statement_timeout TO '15s'
AS $$
DECLARE
    result json;
    start_of_week DATE := anchor_date - ((EXTRACT(DOW FROM anchor_date) + 2) % 7)::INTEGER;
    start_of_month DATE := date_trunc('month', anchor_date)::DATE;
    start_of_year DATE := date_trunc('year', anchor_date)::DATE;
BEGIN
    WITH daily_aggs AS (
        SELECT 
            date,
            SUM(quantity) as qty,
            SUM(fc_quantity) as fc_qty,
            SUM(vf_quantity) as vf_qty
        FROM daily_sales
        WHERE date >= start_of_year - integer '364' AND date <= anchor_date
        GROUP BY date
    )
    SELECT json_build_object(
        'yesterday', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date), 0),
        'fcYesterday', COALESCE(SUM(fc_qty) FILTER (WHERE date = anchor_date), 0),
        'vfYesterday', COALESCE(SUM(vf_qty) FILTER (WHERE date = anchor_date), 0),
        'yesterdayPrevYear', COALESCE(SUM(qty) FILTER (WHERE date = anchor_date - integer '364'), 0),
        
        'weekly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'fcWeekly', COALESCE(SUM(fc_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'vfWeekly', COALESCE(SUM(vf_qty) FILTER (WHERE date >= start_of_week AND date <= anchor_date), 0),
        'weeklyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_week - integer '364' AND date <= anchor_date - integer '364'), 0),
        
        'yearly', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year AND date <= anchor_date), 0),
        'yearlyPrevYear', COALESCE(SUM(qty) FILTER (WHERE date >= start_of_year - integer '364' AND date <= anchor_date - integer '364'), 0)
    ) INTO result
    FROM daily_aggs;

    RETURN result;
END;
$$;

-- 4. Restore Dashboard Trends Function
CREATE OR REPLACE FUNCTION get_dashboard_trends(anchor_date DATE)
RETURNS json
LANGUAGE plpgsql
SET statement_timeout TO '15s'
AS $$
DECLARE
    daily_trends json;
    weekly_trends json;
BEGIN
    -- Daily (Last 30 Days)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.dateStr,
        'quantity', t.qty,
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO daily_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '30' AND date <= anchor_date)
               OR (date > anchor_date - integer '30' - integer '364' AND date <= anchor_date - integer '364')
            GROUP BY date
        )
        SELECT 
            c.date AS dateStr,
            c.qty AS qty,
            COALESCE(p.qty, 0) AS prev_qty
        FROM raw_aggs c
        LEFT JOIN raw_aggs p ON p.date = c.date - integer '364'
        WHERE c.date > anchor_date - integer '30' AND c.date <= anchor_date
        ORDER BY c.date
    ) t;

    -- Weekly (Last 12 Weeks)
    SELECT COALESCE(json_agg(json_build_object(
        'date', t.fri_date,
        'quantity', t.qty,
        'prevYearQuantity', t.prev_qty
    )), '[]'::json) INTO weekly_trends
    FROM (
        WITH raw_aggs AS (
            SELECT date, SUM(quantity) as qty
            FROM daily_sales
            WHERE (date > anchor_date - integer '84' AND date <= anchor_date)
               OR (date >= anchor_date - integer '84' - integer '364' - integer '7' AND date <= anchor_date - integer '364' + integer '7')
            GROUP BY date
        ),
        weekly_aggs_current AS (
            SELECT 
                (date - ((EXTRACT(DOW FROM date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(qty) as total_qty
            FROM raw_aggs
            WHERE date > anchor_date - integer '84' AND date <= anchor_date
            GROUP BY 1
        ),
        weekly_aggs_prev AS (
            SELECT 
                (date - ((EXTRACT(DOW FROM date) + 2) % 7)::INTEGER)::DATE as fri_date,
                SUM(qty) as total_qty
            FROM raw_aggs
            WHERE date >= anchor_date - integer '84' - integer '364' - integer '7' 
              AND date <= anchor_date - integer '364' + integer '7'
            GROUP BY 1
        )
        SELECT 
            c.fri_date,
            c.total_qty AS qty,
            COALESCE(p.total_qty, 0) AS prev_qty
        FROM weekly_aggs_current c
        LEFT JOIN weekly_aggs_prev p ON p.fri_date = c.fri_date - integer '364'
        ORDER BY c.fri_date
    ) t;

    RETURN json_build_object('daily', daily_trends, 'weekly', weekly_trends);
END;
$$;

-- 5. Restore Product Sales Stats (V12 Optimized)
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
        COALESCE(SUM(c.vf_qty) FILTER (WHERE c.date = anchor_date), 0)::BIGINT AS fc_qty_yesterday, -- Wait, this was VF in v12! fixing it to vf_qty
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
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '29' AND c.date <= anchor_date), 0)::BIGINT AS qty_30d,
        COALESCE(SUM(c.qty) FILTER (WHERE c.date >= anchor_date - integer '59' AND c.date <= anchor_date), 0)::BIGINT AS qty_60d,
        json_object_agg(c.date::TEXT, COALESCE(c.qty, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date) AS daily_sales,
        json_object_agg(c.date::TEXT, COALESCE(c.daily_stock_val, 0)) FILTER (WHERE c.date >= start_of_year AND c.date <= anchor_date AND c.daily_stock_val IS NOT NULL) AS daily_stock
    FROM target_barcodes tb
    LEFT JOIN daily_consolidated c ON tb.barcode = c.barcode
    GROUP BY tb.barcode;
END;
$$;

-- 6. Restore Dashboard Insights
CREATE OR REPLACE FUNCTION get_dashboard_insights(anchor_date DATE)
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
        SELECT * FROM product_comparison WHERE diff > 0 ORDER BY diff DESC LIMIT 10
    ),
    top_losers AS (
        SELECT * FROM product_comparison WHERE diff < 0 ORDER BY diff ASC LIMIT 10
    )
    SELECT jsonb_build_object(
        'winners', (SELECT jsonb_agg(w) FROM top_winners w),
        'losers', (SELECT jsonb_agg(l) FROM top_losers l)
    ) INTO result;

    RETURN result;
END;
$$;
