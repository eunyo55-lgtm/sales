const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const anchorDateStr = '2026-03-05';
    console.log(`Verifying final fix for: ${anchorDateStr}...`);

    try {
        // 1. Get total expected sum from daily_sales directly
        const { data: salesData } = await supabase
            .from('daily_sales')
            .select('quantity')
            .eq('date', anchorDateStr);

        const expectedTotal = salesData.reduce((sum, s) => sum + (s.quantity || 0), 0);
        console.log(`- Expected Total from daily_sales: ${expectedTotal}`);

        // 2. Fetch using new manual pagination RPC (V10 must be applied!)
        let totalStatsSum = 0;
        let offset = 0;
        let totalRows = 0;
        const limit = 1000;

        while (true) {
            const { data, error } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: limit,
                offset_val: offset
            });

            if (error) {
                console.error("RPC Error:", error);
                break;
            }
            if (!data || data.length === 0) break;

            data.forEach(s => {
                totalStatsSum += parseInt(s.qty_yesterday || 0);
            });
            totalRows += data.length;
            offset += limit;

            if (data.length < limit) break;
        }

        console.log(`- Paginated RPC total sum: ${totalStatsSum} across ${totalRows} barcodes.`);

        if (expectedTotal === totalStatsSum) {
            console.log("✅ SUCCESS: The totals match exactly!");
        } else {
            console.error(`❌ DISCREPANCY: Expected ${expectedTotal}, got ${totalStatsSum}`);
            console.log("Check if V10 migration was applied correctly and if barcodes were synced.");
        }

    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verify();
