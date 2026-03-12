const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRPC() {
    try {
        const { data, error } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: '2026-03-05',
            limit_val: 10,
            offset_val: 0
        });
        if (error) console.error(error);
        console.log("First 10 Barcodes from RPC:");
        data?.forEach((s, idx) => console.log(`${idx}: ${s.barcode}`));

        // Also check if they are in the products table in this order
        const { data: pData } = await supabase.from('products').select('barcode').order('barcode').limit(10);
        console.log("First 10 Barcodes from products table (ordered):");
        pData?.forEach((p, idx) => console.log(`${idx}: ${p.barcode}`));

    } catch (e) { console.error(e); }
}

inspectRPC();
