const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const anchorDateStr = '2026-03-05';
    console.log(`Debugging 3/5 sales discrepancy...`);

    try {
        // 1. Total quantity from daily_sales for 3/5
        const { data: allSales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .eq('date', anchorDateStr);

        const totalQty = allSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
        console.log(`1. Total qty in daily_sales for 3/5: ${totalQty} (${allSales.length} rows)`);

        // 2. Load all product barcodes
        const allProductBarcodes = new Set();
        let i = 0;
        while (true) {
            const { data } = await supabase.from('products').select('barcode').range(i, i + 999);
            if (!data || data.length === 0) break;
            data.forEach(p => allProductBarcodes.add(p.barcode));
            i += 1000;
            if (data.length < 1000) break;
        }
        console.log(`2. Total products in products table: ${allProductBarcodes.size}`);

        // 3. Compare overlap
        let qtyInProducts = 0;
        let countInProducts = 0;
        let qtyMissingFromProducts = 0;
        let countMissingFromProducts = 0;
        const missingBarcodes = [];

        allSales.forEach(s => {
            if (allProductBarcodes.has(s.barcode)) {
                qtyInProducts += (s.quantity || 0);
                countInProducts++;
            } else {
                qtyMissingFromProducts += (s.quantity || 0);
                countMissingFromProducts++;
                if (missingBarcodes.length < 10) missingBarcodes.push(s.barcode);
            }
        });

        console.log(`3. Overlap Results:`);
        console.log(`   - Quantity for barcodes IN products: ${qtyInProducts} (${countInProducts} rows)`);
        console.log(`   - Quantity for barcodes MISSING from products: ${qtyMissingFromProducts} (${countMissingFromProducts} rows)`);
        if (missingBarcodes.length > 0) {
            console.log(`   - Sample missing barcodes: ${missingBarcodes.join(', ')}`);
        }

        // 4. Check get_product_sales_stats RPC output (first 1000 just for context)
        const { data: rpcStats } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr }).limit(10);
        console.log(`4. Sample RPC output:`, JSON.stringify(rpcStats?.[0], null, 2));

    } catch (e) {
        console.error("Debug failed:", e);
    }
}

debug();
