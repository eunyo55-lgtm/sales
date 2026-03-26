const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function run() {
    // 1. Check products count
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    console.log(`Total products in master: ${prodCount}`);

    // 2. Check unique barcodes in daily_sales for the period
    const { data: uniqueBarcodes, error } = await supabase.rpc('get_unique_barcodes_in_range', { 
        start_d: '2026-03-01', 
        end_d: '2026-03-25' 
    });
    
    // If RPC doesn't exist, we'll try a different way. 
    // Let's create a temporary script that does this if RPC fails.
    if (error) {
        console.log('RPC get_unique_barcodes_in_range not found. Fetching manually...');
        // Manual check of first 1000 barcodes and their presence in products
        const { data: salesBarcodes } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .gte('date', '2026-03-01')
            .lte('date', '2026-03-25')
            .limit(2000);
        
        const uniqueInSales = new Set(salesBarcodes.map(s => s.barcode));
        console.log(`Unique barcodes in first 2000 sales records: ${uniqueInSales.size}`);
        
        const { data: existingProds } = await supabase
            .from('products')
            .select('barcode')
            .in('barcode', Array.from(uniqueInSales));
        
        const existingSet = new Set(existingProds.map(p => p.barcode));
        const missing = Array.from(uniqueInSales).filter(b => !existingSet.has(b));
        
        console.log(`Missing barcodes from product master (sample): ${missing.length} / ${uniqueInSales.size}`);
        if (missing.length > 0) {
            console.log('Sample missing:', missing.slice(0, 5));
        }
    } else {
        console.log(`Unique barcodes in range: ${uniqueBarcodes.length}`);
    }
}

run();
