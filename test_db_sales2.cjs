const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function test() {
    const { data: prods } = await supabase.from('products').select('barcode, name').ilike('name', '%꾸꾸%');
    console.log('Found prods count:', prods.length);
    prods.slice(0, 3).forEach(p => console.log(p.name, p.barcode));

    // Now get the sum of stock for these barcodes on 02-01.
    const barcodes = prods.map(p => p.barcode);
    const { data: sales } = await supabase.from('daily_sales')
        .select('*')
        .in('barcode', barcodes)
        .eq('date', '2026-02-01');
    console.log('Daily sales records for 02-01:', sales.length);
    sales.slice(0, 3).forEach(s => console.log(s.barcode, s.quantity, s.stock));
}
test();
