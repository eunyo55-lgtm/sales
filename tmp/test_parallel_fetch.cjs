const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testParallelFetch() {
    const start_date = '2026-03-01';
    const end_date = '2026-03-25';
    const BATCH_SIZE = 1000;
    const CONCURRENCY = 6;
    let i = 0;
    let isDone = false;
    const allData = [];

    console.time('Parallel Fetch');
    while (!isDone) {
        const promises = [];
        for (let c = 0; c < CONCURRENCY; c++) {
            promises.push(supabase.rpc('get_dashboard_combined_rankings_custom', {
                start_date,
                end_date,
                limit_val: BATCH_SIZE,
                offset_val: i + (c * BATCH_SIZE)
            }));
        }

        const results = await Promise.all(promises);
        for (let c = 0; c < CONCURRENCY; c++) {
            const { data, error } = results[c];
            if (error) { console.error('Error:', error); return; }
            if (data && data.length > 0) allData.push(...data);
            if (!data || data.length < BATCH_SIZE) {
                isDone = true;
                break;
            }
        }
        i += (CONCURRENCY * BATCH_SIZE);
    }
    console.timeEnd('Parallel Fetch');

    console.log(`Total rows fetched: ${allData.length}`);
    const totalQty = allData.reduce((s, r) => s + (r.qty_0y || 0), 0);
    console.log(`Total Qty (2026): ${totalQty}`);
}

testParallelFetch();
