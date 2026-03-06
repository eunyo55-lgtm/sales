const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testParallel() {
    try {
        const anchorDateStr = '2026-03-05';
        const CONCURRENCY = 6;
        const BATCH_SIZE = 1000;

        console.log("Testing Parallel RPC calls (Offset 0-6000)...");
        const promises = [];
        for (let c = 0; c < CONCURRENCY; c++) {
            promises.push(supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: BATCH_SIZE,
                offset_val: c * BATCH_SIZE
            }));
        }

        const results = await Promise.all(promises);
        results.forEach((r, idx) => {
            console.log(`Chunk ${idx} (Offset ${idx * 1000}): ${r.data?.length || 0} rows. ${r.error ? 'ERROR: ' + r.error.message : ''}`);
        });

    } catch (e) { console.error(e); }
}

testParallel();
