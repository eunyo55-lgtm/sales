const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkMissingBarcodes() {
    console.log('Fetching all sales for 2026-03-01 to 2026-03-25...');
    
    let totalSalesQty = 0;
    let barcodeSalesMap = new Map();
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data } = await supabase.from('daily_sales')
            .select('barcode, quantity')
            .gte('date', '2026-03-01')
            .lte('date', '2026-03-25')
            .range(from, from + step - 1);

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            data.forEach(s => {
                totalSalesQty += (s.quantity || 0);
                barcodeSalesMap.set(s.barcode, (barcodeSalesMap.get(s.barcode) || 0) + (s.quantity || 0));
            });
            from += step;
            if (data.length < step) hasMore = false;
        }
        // Safety break
        if (from > 300000) break;
    }

    console.log(`Total Sales Qty in DB: ${totalSalesQty}`);
    console.log(`Unique Barcodes in Sales: ${barcodeSalesMap.size}`);

    // Check which barcodes are in products table
    const allSalesBarcodes = Array.from(barcodeSalesMap.keys());
    const existingBarcodes = new Set();
    
    // Chunked fetching to avoid URI length issues
    console.log('Checking presence in products master...');
    for (let i = 0; i < allSalesBarcodes.length; i += 500) {
        const chunk = allSalesBarcodes.slice(i, i + 500);
        const { data } = await supabase.from('products').select('barcode').in('barcode', chunk);
        if (data) data.forEach(p => existingBarcodes.add(p.barcode));
    }

    let missingQty = 0;
    let missingCount = 0;
    barcodeSalesMap.forEach((qty, barcode) => {
        if (!existingBarcodes.has(barcode)) {
            missingQty += qty;
            missingCount++;
        }
    });

    console.log(`Missing Barcodes Count: ${missingCount}`);
    console.log(`Sales Qty from Missing Barcodes: ${missingQty}`);
    console.log(`Qty that should appear in UI: ${totalSalesQty - missingQty}`);
}

checkMissingBarcodes();
