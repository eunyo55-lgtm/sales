const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkNegatives() {
    console.log('Checking for negative quantities in daily_sales...');
    const { data, error } = await supabase
        .from('daily_sales')
        .select('quantity')
        .lt('quantity', 0)
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-25');

    if (error) { console.error(error); return; }
    console.log(`Negative records found: ${data.length}`);
    const totalNeg = data.reduce((s, r) => s + r.quantity, 0);
    console.log(`Total Negative Quantity: ${totalNeg}`);
}

checkNegatives();
