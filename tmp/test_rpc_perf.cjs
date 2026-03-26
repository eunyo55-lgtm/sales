const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testRPC() {
    console.time('RPC Call');
    const { data, error } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-01',
        end_date: '2026-03-25'
    });
    console.timeEnd('RPC Call');

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log(`RPC returned ${data.length} rows.`);
    
    let total0y = 0;
    let total1y = 0;
    let total2y = 0;
    
    data.forEach(r => {
        total0y += Number(r.qty_0y || 0);
        total1y += Number(r.qty_1y || 0);
        total2y += Number(r.qty_2y || 0);
    });

    console.log('Totals from RPC:');
    console.log(`2026 (qty_0y): ${total0y}`);
    console.log(`2025 (qty_1y): ${total1y}`);
    console.log(`2024 (qty_2y): ${total2y}`);
}

testRPC();
