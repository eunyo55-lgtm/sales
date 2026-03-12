const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const rpcName = 'get_product_sales_stats';
    const params = { anchor_date: '2026-03-05' };
    const order = 'barcode';
    const BATCH_SIZE = 1000;
    const allData = [];
    let i = 0;
    const CONCURRENCY = 6;
    let isDone = false;

    console.log(`Starting paginated fetch for ${rpcName}...`);

    while (!isDone) {
        const batchPromises = [];
        console.log(`Fetching batch range start: ${i}`);
        for (let c = 0; c < CONCURRENCY; c++) {
            let q = supabase.rpc(rpcName, params);
            q = q.range(i + (c * BATCH_SIZE), i + (c * BATCH_SIZE) + BATCH_SIZE - 1);
            if (order) q = q.order(order);
            batchPromises.push(q);
        }

        const results = await Promise.all(batchPromises);

        for (let c = 0; c < CONCURRENCY; c++) {
            const { data, error } = results[c];
            if (error) {
                console.error(`Error in batch ${c}:`, error);
                isDone = true;
                break;
            }

            if (data && data.length > 0) {
                allData.push(...data);
                console.log(`Batch ${c} returned ${data.length} rows. Total so far: ${allData.length}`);
            } else {
                console.log(`Batch ${c} returned no data.`);
            }

            if (!data || data.length < BATCH_SIZE) {
                console.log(`Stopping: Batch ${c} length ${data ? data.length : 0} < ${BATCH_SIZE}`);
                isDone = true;
                break;
            }
        }
        i += (CONCURRENCY * BATCH_SIZE);
        if (allData.length > 20000) break; // Safety break
    }

    console.log(`Final total rows: ${allData.length}`);
    const totalQty = allData.reduce((sum, row) => sum + parseInt(row.qty_yesterday || 0), 0);
    console.log(`Total qty_yesterday: ${totalQty}`);
}

verify();
