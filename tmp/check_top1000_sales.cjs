const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkTop1000Sales() {
    // 1. Get first 1000 products by barcode
    const { data: prods } = await supabase.from('products').select('barcode').order('barcode').limit(1000);
    const barcodes = prods.map(p => p.barcode);
    
    // 2. Sum sales for these barcodes in March
    console.log(`Checking sales for the first 1000 products (by barcode)...`);
    const { data: sales, error } = await supabase.from('daily_sales')
        .select('quantity')
        .in('barcode', barcodes)
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-25');
    
    if (error) { console.error(error); return; }
    
    const sum = sales.reduce((s, r) => s + (r.quantity || 0), 0);
    console.log(`Total Sales Qty for first 1000 products: ${sum}`);
}

checkTop1000Sales();
