const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnchorDate() {
    try {
        console.log("Simulating api.ts anchor date logic...");
        const { data: latestData, error } = await supabase
            .from('daily_sales')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error("Error fetching latest date:", error);
        } else {
            console.log("Latest Data from query:", latestData);
            const anchorDateStr = latestData ? latestData.date.substring(0, 10) : new Date().toISOString().split('T')[0];
            console.log(`Calculated anchorDateStr: [${anchorDateStr}]`);
        }

        // Also check if there's any weird data for early Jan
        const { data: janSales } = await supabase
            .from('daily_sales')
            .select('date, quantity')
            .gte('date', '2026-01-01')
            .lte('date', '2026-01-07')
            .limit(10);
        console.log("\nSample sales from first week of Jan:");
        console.log(janSales);

    } catch (e) { console.error(e); }
}

checkAnchorDate();
