const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPCs() {
    const anchorDate = '2026-03-09'; // Example date

    console.log("Testing get_dashboard_metrics...");
    const { data: m, error: mErr } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDate });
    console.log("Metrics:", m, "Error:", mErr);

    console.log("Testing get_dashboard_trends...");
    const { data: t, error: tErr } = await supabase.rpc('get_dashboard_trends', { anchor_date: anchorDate });
    console.log("Trends:", t, "Error:", tErr);

    console.log("Testing get_product_sales_stats...");
    const { data: s, error: sErr } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDate });
    console.log("Stats (first 1):", s?.[0], "Error:", sErr);
}

testRPCs();
