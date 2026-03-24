require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking RPC get_dashboard_combined_rankings_custom...");
    const { data, error } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-20',
        end_date: '2026-03-23'
    });

    if (error) {
        console.error("RPC Error:", error.message, error.details, error.hint);
    } else {
        console.log("RPC Success. Row count:", data?.length);
        if (data && data.length > 0) {
            console.log("Sample data:", data[0]);
        }
    }
}

check();
