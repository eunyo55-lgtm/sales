const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

// Replicate the exact logic from api.ts
async function _fetchAllParallel(table, select, order) {
    const BATCH_SIZE = 1000;
    const allData = [];
    let i = 0;
    const CONCURRENCY = 6;
    let isDone = false;

    while (!isDone) {
        console.log(`Starting iteration at offset ${i}...`);
        const batchPromises = [];
        for (let c = 0; c < CONCURRENCY; c++) {
            let q = supabase.from(table).select(select);
            const from = i + (c * BATCH_SIZE);
            const to = i + (c * BATCH_SIZE) + BATCH_SIZE - 1;
            q = q.range(from, to);
            if (order) q = q.order(order);
            batchPromises.push(q);
        }

        const results = await Promise.all(batchPromises);

        for (let c = 0; c < CONCURRENCY; c++) {
            const { data, error } = results[c];
            if (error) {
                console.error(`Fetch error at result index ${c}:`, error);
                throw error;
            }

            if (data && data.length > 0) {
                console.log(`  Batch ${c}: fetched ${data.length} rows (range ${i + (c * BATCH_SIZE)} to ${i + (c * BATCH_SIZE) + BATCH_SIZE - 1})`);
                allData.push(...data);
            } else {
                console.log(`  Batch ${c}: fetched 0 rows.`);
            }

            if (!data || data.length < BATCH_SIZE) {
                console.log(`  Batch ${c} is partial or empty (${data?.length}). Terminating loop.`);
                isDone = true;
                break;
            }
        }
        i += (CONCURRENCY * BATCH_SIZE);
    }
    return allData;
}

async function test() {
    try {
        const data = await _fetchAllParallel(
            'coupang_orders',
            'order_date, barcode, order_qty, confirmed_qty, received_qty, unit_cost',
            'order_date'
        );
        console.log(`\nFinal result count: ${data.length}`);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
