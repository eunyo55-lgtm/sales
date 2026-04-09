CREATE OR REPLACE FUNCTION get_custom_daily_sales_trend(start_date date, end_date date)
RETURNS TABLE(date text, quantity bigint, prevYearQuantity bigint, prev2YearQuantity bigint)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE dates AS (
    SELECT start_date AS d
    UNION ALL
    SELECT d + 1 FROM dates WHERE d < end_date
  ),
  current_year AS (
    SELECT date, COALESCE(SUM(ds.quantity), 0) AS qty
    FROM daily_sales ds
    WHERE date >= start_date AND date <= end_date
    GROUP BY date
  ),
  prev_year AS (
    SELECT (date + interval '1 year')::date as mapped_date, COALESCE(SUM(ds.quantity), 0) AS qty
    FROM daily_sales ds
    WHERE date >= start_date - interval '1 year' AND date <= end_date - interval '1 year'
    GROUP BY date
  ),
  prev2_year AS (
    SELECT (date + interval '2 years')::date as mapped_date, COALESCE(SUM(ds.quantity), 0) AS qty
    FROM daily_sales ds
    WHERE date >= start_date - interval '2 years' AND date <= end_date - interval '2 years'
    GROUP BY date
  )
  SELECT 
    to_char(d.d, 'YYYY-MM-DD'),
    COALESCE(c.qty, 0) AS quantity,
    COALESCE(p1.qty, 0) AS prevYearQuantity,
    COALESCE(p2.qty, 0) AS prev2YearQuantity
  FROM dates d
  LEFT JOIN current_year c ON d.d = c.date
  LEFT JOIN prev_year p1 ON d.d = p1.mapped_date
  LEFT JOIN prev2_year p2 ON d.d = p2.mapped_date
  ORDER BY d.d;
END;
$$;
