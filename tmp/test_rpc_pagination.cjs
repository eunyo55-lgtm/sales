const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPagination() {
    const anchorDateStr = '2026-03-05';
    console.log(`Testing RPC pagination for: ${anchorDateStr}`);

    try {
        // Page 1
        const { data: p1, error: e1 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr }).range(0, 9);
        if (e1) console.error("Page 1 Error:", e1);
        else console.log("Page 1 first barcode:", p1?.[0]?.barcode);

        // Page 2
        const { data: p2, error: e2 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr }).range(10, 19);
        if (e2) console.error("Page 2 Error:", e2);
        else console.log("Page 2 first barcode:", p2?.[0]?.barcode);

        if (p1?.[0]?.barcode === p2?.[0]?.barcode) {
            console.log("CRITICAL: Pagination NOT working! Page 1 and Page 2 are identical.");
        } else {
            console.log("Pagination seems to work (different barcodes).");
        }

        // Check total count header if possible
        const { count, error: e3 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr }, { count: 'exact', head: true });
        console.log("Total count via RPC header:", count, e3);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testPagination();
