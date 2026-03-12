const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKkukkkuYearly() {
    try {
        const barcodes = ['O01L12UOW180', 'O01L12UOW140'];
        const anchorDate = '2026-03-05';

        // 1. Check direct from daily_sales
        const { data: sales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .in('barcode', barcodes)
            .gte('date', '2026-01-01')
            .lte('date', anchorDate);

        const sums = {};
        sales?.forEach(s => {
            sums[s.barcode] = (sums[s.barcode] || 0) + s.quantity;
        });
        console.log("Calculated Year Sums:", sums);

        // 2. Check from RPC (Fetch a large chunk)
        const { data: rpcData, error } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: anchorDate,
            limit_val: 6000,
            offset_val: 0
        });

        if (error) {
            console.error("RPC Error:", error);
        } else {
            const matches = rpcData?.filter(s => barcodes.includes(s.barcode));
            console.log("RPC Data for Kkukkku (Found in first 6000):");
            console.log(JSON.stringify(matches, null, 2));
        }

    } catch (e) { console.error(e); }
}

checkKkukkkuYearly();
