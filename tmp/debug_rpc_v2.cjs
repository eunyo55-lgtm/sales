const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRPC() {
    try {
        const bc = 'O01L12UOW180';
        const anchor = '2026-03-05';

        // 1. Direct query to check if it exists in daily_sales within the range
        const { data: sales } = await supabase
            .from('daily_sales')
            .select('*')
            .eq('barcode', bc)
            .gte('date', '2026-01-01');
        console.log(`Direct sales count for ${bc} since Jan 1: ${sales?.length || 0}`);

        // 2. Call RPC with tiny limit to see if it even returns this barcode correctly if we set offset?
        // We know its offset is 2444.
        const { data: rpcRes } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: anchor,
            limit_val: 1,
            offset_val: 2444
        });
        console.log("RPC Result at offset 2444:");
        console.log(JSON.stringify(rpcRes, null, 2));

    } catch (e) { console.error(e); }
}

debugRPC();
