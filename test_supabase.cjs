require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: latestData, error: latestError } = await supabase
        .from('daily_sales')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

    console.log("Latest Date:", latestData, latestError);

    // Let's also get a breakdown of the dates to see if there's corrupted data
    const { data: sales, error: salesError } = await supabase
        .from('daily_sales')
        .select('date, barcode, quantity')
        .order('date', { ascending: false })
        .limit(10);

    console.log("Recent 5 sales:", sales);
}

run();
