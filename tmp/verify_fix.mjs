// verify_fix_mock.mjs
import { api } from './src/lib/api.js'; // This won't work easily with node because of TS/ESM.
// Let's create a simpler verification script that uses the underlying rpc logic via supabase client.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const anchorDateStr = '2026-03-05';
    console.log(`Verifying data for: ${anchorDateStr}`);

    async function fetchRPCParallel(rpcName, params, order) {
        const BATCH_SIZE = 1000;
        const allData = [];
        let i = 0;
        const CONCURRENCY = 6;
        let isDone = false;

        while (!isDone) {
            const batchPromises = [];
            for (let c = 0; c < CONCURRENCY; c++) {
                let q = supabase.rpc(rpcName, params);
                q = q.range(i + (c * BATCH_SIZE), i + (c * BATCH_SIZE) + BATCH_SIZE - 1);
                if (order) q = q.order(order);
                batchPromises.push(q);
            }

            const results = await Promise.all(batchPromises);

            for (let c = 0; c < CONCURRENCY; c++) {
                const { data, error } = results[c];
                if (error) throw error;
                if (data && data.length > 0) allData.push(...data);
                if (!data || data.length < BATCH_SIZE) {
                    isDone = true;
                    break;
                }
            }
            i += (CONCURRENCY * BATCH_SIZE);
        }
        return allData;
    }

    try {
        const { data: metrics } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDateStr });
        const dashboardTotal = metrics.statYesterday;
        console.log(`Dashboard statYesterday: ${dashboardTotal}`);

        const stats = await fetchRPCParallel('get_product_sales_stats', { anchor_date: anchorDateStr }, 'barcode');
        const rpcTotal = stats.reduce((sum, s) => sum + parseInt(s.qty_yesterday || 0), 0);
        console.log(`Paginated RPC Total (qty_yesterday): ${rpcTotal} across ${stats.length} barcodes`);

        if (dashboardTotal === rpcTotal) {
            console.log("SUCCESS: Data matches!");
        } else {
            console.error(`FAILURE: Data mismatch! Dashboard: ${dashboardTotal}, RPC: ${rpcTotal}`);
        }

    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verify();
