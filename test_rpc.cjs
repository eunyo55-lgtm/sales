const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPCs() {
    const anchorDateStr = new Date().toISOString().split('T')[0];

    console.log(`Testing RPCs with anchor_date: ${anchorDateStr}`);

    try {
        console.time("get_dashboard_metrics");
        const { data: metrics, error: e1 } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDateStr });
        if (e1) console.error("Error in get_dashboard_metrics:", e1);
        else console.log("get_dashboard_metrics returned:", !!metrics);
        console.timeEnd("get_dashboard_metrics");

        console.time("get_dashboard_trends");
        const { data: trends, error: e2 } = await supabase.rpc('get_dashboard_trends', { anchor_date: anchorDateStr });
        if (e2) console.error("Error in get_dashboard_trends:", e2);
        else console.log("get_dashboard_trends returned:", !!trends);
        console.timeEnd("get_dashboard_trends");

        console.time("get_product_sales_stats");
        const { data: stats, error: e3 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr });
        if (e3) console.error("Error in get_product_sales_stats:", e3);
        else console.log(`get_product_sales_stats returned ${stats?.length} rows`);
        console.timeEnd("get_product_sales_stats");

    } catch (e) {
        console.error("Caught error:", e);
    }
}

testRPCs();
