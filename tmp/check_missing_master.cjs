const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking discrepancy cause for: ${anchorDateStr}`);

    try {
        // 1. Get all unique barcodes in daily_sales for that date
        const { data: salesData } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .eq('date', anchorDateStr);

        const salesBarcodes = new Map();
        salesData.forEach(s => {
            salesBarcodes.set(s.barcode, (salesBarcodes.get(s.barcode) || 0) + (s.quantity || 0));
        });
        console.log(`Unique barcodes with sales on ${anchorDateStr}: ${salesBarcodes.size}`);
        const totalSales = Array.from(salesBarcodes.values()).reduce((a, b) => a + b, 0);
        console.log(`Total Sales Qty for ${anchorDateStr}: ${totalSales}`);

        // 2. Fetch all products (chunked)
        const productBarcodes = new Set();
        let i = 0;
        while (true) {
            const { data } = await supabase.from('products').select('barcode').range(i, i + 999);
            if (!data || data.length === 0) break;
            data.forEach(p => productBarcodes.add(p.barcode));
            if (data.length < 1000) break;
            i += 1000;
        }
        console.log(`Total products in master: ${productBarcodes.size}`);

        // 3. Find missing
        let missingQty = 0;
        let missingCount = 0;
        let foundQty = 0;
        let foundCount = 0;

        for (const [barcode, qty] of salesBarcodes.entries()) {
            if (productBarcodes.has(barcode)) {
                foundQty += qty;
                foundCount++;
            } else {
                missingQty += qty;
                missingCount++;
            }
        }

        console.log(`Summary:`);
        console.log(`- Barcodes FOUND in products: ${foundCount} (Qty: ${foundQty})`);
        console.log(`- Barcodes MISSING from products: ${missingCount} (Qty: ${missingQty})`);

        if (missingCount > 0) {
            console.log(`Sample missing barcodes (first 5):`);
            const samples = Array.from(salesBarcodes.keys()).filter(b => !productBarcodes.has(b)).slice(0, 5);
            console.log(samples);
        }

    } catch (e) {
        console.error(e);
    }
}

check();
