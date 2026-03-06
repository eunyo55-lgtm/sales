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
    console.log('Fetching products matching 꾸꾸...');
    const { data: prods } = await supabase.from('products').select('barcode, name').ilike('name', '%꾸꾸%');
    const barcodes = prods.map(p => p.barcode);

    const { data: sales } = await supabase.from('daily_sales')
        .select('date, quantity, stock, barcode')
        .in('barcode', barcodes)
        .gte('date', '2026-02-01')
        .lte('date', '2026-02-10')
        .order('date', { ascending: true });

    let dateSum = {};
    sales.forEach(s => {
        if (!dateSum[s.date]) dateSum[s.date] = 0;
        dateSum[s.date] += Number(s.stock || 0);
    });
    console.log('Grouped DB Stock by Date:');
    Object.keys(dateSum).sort().forEach(d => {
        console.log(d, '=>', dateSum[d]);
    });
}
test();
