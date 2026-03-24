const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("1. Checking if get_dashboard_combined_rankings_custom RPC exists...");
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-20',
        end_date: '2026-03-23'
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
    } else {
        console.log(`RPC Success. Returned ${rpcData?.length} rows.`);
        if (rpcData && rpcData.length > 0) {
            console.log("Sample Data:", rpcData[0]);
        }
    }

    console.log("\n2. Checking if 2024 data exists in daily_sales...");
    const { data: salesData, error: salesError } = await supabase
        .from('daily_sales')
        .select('date, quantity')
        .gte('date', '2024-01-01')
        .lte('date', '2024-12-31')
        .limit(5);

    if (salesError) {
        console.error("Sales Error:", salesError);
    } else {
        console.log(`2024 Sales Query Success. Returned ${salesData?.length} sample rows.`);
        if (salesData && salesData.length > 0) {
            console.log("Sample 2024 Data:", salesData);
        }
    }
}

check();
