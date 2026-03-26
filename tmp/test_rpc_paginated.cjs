const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testPaginatedRPC() {
    let allData = [];
    let i = 0;
    const BATCH_SIZE = 1000;
    let isDone = false;

    console.time('Full Paginated RPC Fetch');
    while (!isDone) {
        const { data, error } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
            start_date: '2026-03-01',
            end_date: '2026-03-25',
            limit_val: BATCH_SIZE,
            offset_val: i
        });

        if (error) {
            console.error('RPC Error:', error);
            break;
        }

        if (data && data.length > 0) {
            allData.push(...data);
        }

        if (!data || data.length < BATCH_SIZE) {
            isDone = true;
        }
        i += BATCH_SIZE;
        if (i > 100000) break;
    }
    console.timeEnd('Full Paginated RPC Fetch');

    console.log(`Total rows fetched: ${allData.length}`);
    
    let total0y = 0;
    let total1y = 0;
    let total2y = 0;
    
    allData.forEach(r => {
        total0y += Number(r.qty_0y || 0);
        total1y += Number(r.qty_1y || 0);
        total2y += Number(r.qty_2y || 0);
    });

    console.log('Final Aggregated Totals:');
    console.log(`2026 (qty_0y): ${total0y}`);
    console.log(`2025 (qty_1y): ${total1y}`);
    console.log(`2024 (qty_2y): ${total2y}`);
}

testPaginatedRPC();
