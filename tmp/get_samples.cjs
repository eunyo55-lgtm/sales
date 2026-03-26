const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function getSamples() {
    console.log('--- Sales Samples (March 20) ---');
    const { data: sales } = await supabase.from('daily_sales')
        .select('barcode, quantity')
        .eq('date', '2026-03-20')
        .gt('quantity', 0)
        .limit(5);
    console.log(JSON.stringify(sales, null, 2));

    const barcodes = sales ? sales.map(s => s.barcode) : [];
    
    console.log('--- Matching Product Master Samples ---');
    const { data: prods } = await supabase.from('products')
        .select('barcode, name')
        .in('barcode', barcodes);
    console.log(JSON.stringify(prods, null, 2));
}

getSamples();
