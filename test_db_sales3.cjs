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
    const barcodes = prods.map(p => p.barcode);
    const { data: sales } = await supabase.from('daily_sales')
        .select('*')
        .in('barcode', barcodes)
        .eq('date', '2026-02-01');
    console.log('Daily sales records for 02-01:', sales.length);
    sales.slice(0, 10).forEach(s => console.log(s));
}
test();
