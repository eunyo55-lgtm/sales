const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log("Checking columns of daily_sales...");
    // We can try to select all columns from one row (even if empty)
    // but better to try and see which ones fail.
    const { data, error } = await supabase.from('daily_sales').select('*').limit(1);
    if (error) {
        console.error("Select * Error:", error);
    } else {
        console.log("Columns present in first row (if any):", data.length > 0 ? Object.keys(data[0]) : "No data to check keys");
    }

    // specifically check for 'stock'
    const { data: stockData, error: stockErr } = await supabase.from('daily_sales').select('stock').limit(1);
    if (stockErr) {
        console.error("Stock column check failed:", stockErr.message);
    } else {
        console.log("Stock column exists!");
    }
}

checkColumns();
