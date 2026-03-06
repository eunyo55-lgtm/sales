const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking master table overlap for: ${anchorDateStr}`);

    try {
        // 1. Fetch all product barcodes
        const masterBarcodes = new Set();
        let i = 0;
        while (true) {
            const { data } = await supabase.from('products').select('barcode').range(i, i + 999);
            if (!data || data.length === 0) break;
            data.forEach(p => masterBarcodes.add(p.barcode));
            if (data.length < 1000) break;
            i += 1000;
        }
        console.log(`- Total products in master: ${masterBarcodes.size}`);

        // 2. Fetch all RPC barcodes and check presence
        let offset = 0;
        let foundCount = 0;
        let missingCount = 0;
        let foundQty = 0;
        let missingQty = 0;

        while (true) {
            const { data, error } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: 1000,
                offset_val: offset
            });
            if (error) break;
            if (!data || data.length === 0) break;

            data.forEach(s => {
                const qty = parseInt(s.qty_yesterday || 0);
                if (masterBarcodes.has(s.barcode)) {
                    foundCount++;
                    foundQty += qty;
                } else {
                    missingCount++;
                    missingQty += qty;
                }
            });
            offset += 1000;
        }

        console.log(`Summary for 3/5:`);
        console.log(`- Barcodes IN master: ${foundCount} (Sum Qty: ${foundQty})`);
        console.log(`- Barcodes MISSING from master: ${missingCount} (Sum Qty: ${missingQty})`);

        if (missingCount > 0) {
            console.log("THIS IS THE PROBLEM! Total UI sum will be foundQty.");
        }

    } catch (e) { console.error(e); }
}

check();
