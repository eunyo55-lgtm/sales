const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // If we can't use pg_tables, maybe we can use a known function or just try common names
    const commonNames = ['daily_sales', 'daily_sale', 'sales', 'sales_data', 'coupang_sales'];
    for (const name of commonNames) {
        const { data, error } = await supabase.from(name).select('*').limit(1);
        if (!error) {
            console.log(`Table exists: ${name}`);
        } else {
            console.log(`Table ${name} does not exist or error: ${error.message}`);
        }
    }
}

check();
