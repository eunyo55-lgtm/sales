import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const anchorDate = '2026-03-06';
    const targetDate = '2026-03-05';
    console.log(`--- Global RPC Verification for ${targetDate} ---`);

    let allData: any[] = [];
    let offset = 0;
    const BATCH = 1000;

    while (true) {
        const { data, error } = await supabase
            .rpc('get_product_sales_stats', { anchor_date: anchorDate })
            .range(offset, offset + BATCH - 1);

        if (error) {
            console.error("RPC Error:", error);
            break;
        }
        if (!data || data.length === 0) break;

        allData.push(...data);
        offset += BATCH;
        if (data.length < BATCH) break;
    }

    console.log(`Successfully fetched ${allData.length} products via RPC.`);

    // Verify 3/5 match
    const rowsWithTargetDate = allData.filter(r => r.daily_sales && r.daily_sales[targetDate]);
    const total35 = rowsWithTargetDate.reduce((sum, r) => sum + (Number(r.daily_sales[targetDate]) || 0), 0);

    console.log(`Total Sales for ${targetDate} (Aggregated from JSON):`, total35);

    if (total35 === 1946) {
        console.log("✅ MATCH! The JSON aggregation bug is fixed.");
    } else {
        console.log("❌ MISMATCH! Expected 1946 but got", total35);
    }

    const totalYear = allData.reduce((sum, r) => sum + (Number(r.qty_year) || 0), 0);
    console.log("Total Year-to-Date Sales (All items):", totalYear);
}

test();
