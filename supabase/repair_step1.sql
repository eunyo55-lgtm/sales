-- STEP 1: Restore daily_sales table and policies
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

-- Enable RLS and Policies
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_sales" ON daily_sales;
CREATE POLICY "Allow all access to daily_sales" ON daily_sales FOR ALL USING (true) WITH CHECK (true);
