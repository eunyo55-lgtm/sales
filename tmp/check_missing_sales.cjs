const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingSales() {
    try {
        const date = '2026-03-05';

        // 1. Get all sales for that date
        const { data: allSales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .eq('date', date);

        const totalSales = allSales?.reduce((sum, s) => sum + s.quantity, 0) || 0;
        console.log(`Total Sales in daily_sales for ${date}: ${totalSales}`);

        // 2. Get all barcodes in products table
        const { data: products } = await supabase
            .from('products')
            .select('barcode');
        const productBarcodes = new Set(products?.map(p => p.barcode));
        console.log(`Total Products in master: ${productBarcodes.size}`);

        // 3. Compare
        let missingSales = 0;
        let missingBarcodes = new Set();
        allSales?.forEach(s => {
            if (!productBarcodes.has(s.barcode)) {
                missingSales += s.quantity;
                missingBarcodes.add(s.barcode);
            }
        });

        console.log(`Sales for UNKNOWN barcodes (not in products): ${missingSales}`);
        console.log(`Number of unknown barcodes with sales: ${missingBarcodes.size}`);

        if (missingBarcodes.size > 0) {
            console.log("\nSample missing barcodes:", Array.from(missingBarcodes).slice(0, 5));
        }

    } catch (e) { console.error(e); }
}

checkMissingSales();
