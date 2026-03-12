const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKkukkkuYearly() {
    try {
        const barcodes = ['O01L12UOW180', 'O01L12UOW140'];
        const anchorDate = '2026-03-05';

        // 1. Check direct from daily_sales
        const { data: yearlySales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity.sum()')
            .in('barcode', barcodes)
            .gte('date', '2026-01-01')
            .lte('date', anchorDate);
        console.log("Yearly Sum from daily_sales:", yearlySales);

        // 2. Check from RPC
        const { data: rpcData } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: anchorDate,
            limit_val: 10000, // Fetch more to be sure
            offset_val: 0
        });

        const matches = rpcData?.filter(s => barcodes.includes(s.barcode));
        console.log("RPC Data for Kkukkku:");
        console.log(JSON.stringify(matches, null, 2));

    } catch (e) { console.error(e); }
}

checkKkukkkuYearly();
