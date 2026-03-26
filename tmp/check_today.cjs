const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkToday() {
    const { data } = await supabase.from('daily_sales').select('quantity').eq('date', '2026-03-26');
    const sum = data ? data.reduce((s, r) => s + (r.quantity || 0), 0) : 0;
    console.log(`Total for 2026-03-26: ${sum}`);
}

checkToday();
