const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteDistortedData() {
    console.log("Deleting distorted data for 2026-01-01 ~ 2026-01-08 (uploaded on 2026-03-12)...");
    
    const { data, error, count } = await supabase
        .from('coupang_orders')
        .delete({ count: 'exact' })
        .gte('order_date', '2026-01-01')
        .lte('order_date', '2026-01-08')
        .gte('created_at', '2026-03-12')
        .lte('created_at', '2026-03-12T23:59:59');

    if (error) {
        console.error("Error deleting data:", error);
        return;
    }

    console.log(`Successfully deleted ${count} rows.`);
}

deleteDistortedData();
