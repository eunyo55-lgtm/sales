const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    try {
        console.log("Checking Page 1 (offset 0):");
        const { data: p1 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr, limit_val: 10, offset_val: 0 });
        console.log("- Count:", p1?.length, "First:", p1?.[0]?.barcode);

        console.log("Checking Page 100 (offset 1000):");
        const { data: p2 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr, limit_val: 10, offset_val: 1000 });
        console.log("- Count:", p2?.length, "First:", p2?.[0]?.barcode);

        if (p1?.[0]?.barcode === p2?.[0]?.barcode) {
            console.log("!!! BUG: Offset is IGNORED! Both pages returned the same first barcode.");
        } else if (!p2 || p2.length === 0) {
            console.log("!!! BUG: Offset 1000 returned NOTHING! But we know there are 9264 rows.");
        } else {
            console.log("Success: Offset seems to work (different barcodes).");
        }

    } catch (e) { console.error(e); }
}

check();
