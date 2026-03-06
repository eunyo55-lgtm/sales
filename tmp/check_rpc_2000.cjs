const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOffset2000() {
    try {
        console.time("RPC_Offset_2000");
        const { data, error } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: '2026-03-05',
            limit_val: 1000,
            offset_val: 2000
        });
        console.timeEnd("RPC_Offset_2000");

        if (error) {
            console.error("RPC Error:", error);
        } else {
            console.log(`Received ${data?.length || 0} items.`);
            const matches = data?.filter(s => s.barcode.startsWith('O01L12U'));
            console.log(`Found ${matches?.length || 0} '꾸꾸'-like barcodes.`);
            if (matches && matches.length > 0) {
                console.log("First match:", JSON.stringify(matches[0], null, 2));
            }
        }

    } catch (e) { console.error(e); }
}

checkOffset2000();
