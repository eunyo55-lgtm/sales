const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking daily_sales...");
    const { count, error } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true });
    if (error) {
        console.error("Count Error:", error);
    } else {
        console.log("Daily Sales Count:", count);
    }

    // Check first few rows if count > 0
    if (count > 0) {
        const { data, error: dErr } = await supabase.from('daily_sales').select('*').limit(5);
        console.log("Sample Data:", data);
    } else {
        console.log("Table is empty.");
    }
}

check();
