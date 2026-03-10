-- STEP 2: Restore Dashboard Metrics Function
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
