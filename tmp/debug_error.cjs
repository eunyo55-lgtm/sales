const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log("Fetching daily_sales with detailed error logging...");
        const result = await supabase.from('daily_sales').select('date').limit(1);
        console.log("Full Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Caught Exception:", e);
    }
}

check();
