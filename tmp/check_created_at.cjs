const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCreatedAt() {
    console.log("Checking created_at sample for Jan 2026 data...");
    
    const { data, error } = await supabase
        .from('coupang_orders')
        .select('created_at')
        .gte('order_date', '2026-01-01')
        .lte('order_date', '2026-01-08')
        .limit(10);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Sample created_at values:", data.map(d => d.created_at));
    }
}

checkCreatedAt();
