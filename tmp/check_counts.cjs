const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking counts for: ${anchorDateStr}`);

    try {
        // 1. Count unique barcodes in daily_sales for anchor_date
        const { count: salesCount, error: e1 } = await supabase
            .from('daily_sales')
            .select('barcode', { count: 'exact', head: true })
            .eq('date', anchorDateStr);

        console.log(`Total unique barcodes (rows) in daily_sales for ${anchorDateStr}: ${salesCount}`);

        // 2. Count total barcodes in daily_sales (all time)
        const { count: totalSalesCount, error: e2 } = await supabase
            .from('daily_sales')
            .select('barcode', { count: 'exact', head: true });
        console.log(`Total rows in daily_sales (all time): ${totalSalesCount}`);

        // 3. Count total products
        const { count: productCount, error: e3 } = await supabase
            .from('products')
            .select('barcode', { count: 'exact', head: true });
        console.log(`Total products in products table: ${productCount}`);

    } catch (e) {
        console.error("Catch:", e);
    }
}

check();
