const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIndex() {
    try {
        console.log("Checking daily_sales table row count and indexes...");

        // Check row count
        const { count, error: countErr } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true });
        console.log(`Total rows in daily_sales: ${count}`);

        // Try a very simple sum to see benchmark
        console.time("Simple SUM Benchmark");
        const { data: sumData, error: sumErr } = await supabase.from('daily_sales').select('quantity').limit(100);
        console.timeEnd("Simple SUM Benchmark");

        // Use RPC to check indexes (standard postgres way)
        const { data: indexData, error: indexErr } = await supabase.rpc('get_table_info', { table_name: 'daily_sales' }).catch(() => ({ data: null }));
        if (indexData) console.log("Table info:", indexData);

    } catch (e) { console.error(e); }
}

checkIndex();
