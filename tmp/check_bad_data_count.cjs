const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDistortedData() {
    console.log("Checking for data for 2026-01-01 ~ 2026-01-08...");
    
    // Check total rows for that range
    const { data: totalData, count: totalCount, error: totalError } = await supabase
        .from('coupang_orders')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', '2026-01-01')
        .lte('order_date', '2026-01-08');

    if (totalError) {
        console.error("Error checking total data:", totalError);
    } else {
        console.log(`Total rows for 2026-01-01 ~ 2026-01-08: ${totalCount}`);
    }

    // Check rows with specific created_at
    const { data: createdData, count: createdCount, error: createdError } = await supabase
        .from('coupang_orders')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', '2026-01-01')
        .lte('order_date', '2026-01-08')
        .gte('created_at', '2026-03-12')
        .lte('created_at', '2026-03-12T23:59:59');

    if (createdError) {
        console.error("Error checking created_at data:", createdError);
    } else {
        console.log(`Rows for 2026-01-01 ~ 2026-01-08 created on 2026-03-12: ${createdCount}`);
    }
}

checkDistortedData();
