const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function simulateUILoad() {
    const startDate = '2026-03-01';
    const endDate = '2026-03-25';

    console.log(`Simulating Load for ${startDate} ~ ${endDate}`);

    // Imitting _fetchRPCParallel logic
    const BATCH_SIZE = 1000;
    const CONCURRENCY = 6;
    let i = 0;
    let isDone = false;
    const rankings = [];

    while (!isDone) {
        const promises = [];
        for (let c = 0; c < CONCURRENCY; c++) {
            promises.push(supabase.rpc('get_dashboard_combined_rankings_custom', {
                start_date: startDate,
                end_date: endDate,
                limit_val: BATCH_SIZE,
                offset_val: i + (c * BATCH_SIZE)
            }));
        }
        const results = await Promise.all(promises);
        for (let c = 0; c < CONCURRENCY; c++) {
            const { data, error } = results[c];
            if (error) { throw error; }
            if (data && data.length > 0) rankings.push(...data);
            if (!data || data.length < BATCH_SIZE) {
                isDone = true;
                break;
            }
        }
        i += (CONCURRENCY * BATCH_SIZE);
        if (i > 100000) break;
    }

    console.log(`Step 1: Raw Rankings Count = ${rankings.length}`);

    // Imitting getDashboardCombinedRankings mapping
    const combinedRankings = rankings.map((r, index) => ({
        name: r.name,
        imageUrl: r.image_url,
        qty_0y: Number(r.qty_0y || 0),
        qty_1y: Number(r.qty_1y || 0),
        qty_2y: Number(r.qty_2y || 0),
        trend: Number(r.trend || 0),
        cost: Number(r.cost || 0),
        rank: index + 1
    }));

    console.log(`Step 2: Mapped Rankings Count = ${combinedRankings.length}`);

    // Imitting Dashboard memoized sorting/filtering
    let filtered = combinedRankings; // SearchQuery is empty in screenshot
    const sorted = [...filtered].sort((a, b) => {
        // Default sort: qty_0y desc
        return b.qty_0y - a.qty_0y;
    });

    console.log(`Step 3: Sorted Rankings Top 3:`, JSON.stringify(sorted.slice(0, 3), null, 2));

    const totalQty = sorted.reduce((s, r) => s + r.qty_0y, 0);
    console.log(`Step 4: Total Qty (2026) = ${totalQty}`);
}

simulateUILoad().catch(console.error);
