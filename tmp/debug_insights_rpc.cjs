const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInsights() {
    try {
        const anchorDate = '2026-03-05';
        console.log(`Testing get_dashboard_insights for anchor: ${anchorDate}`);

        const { data, error } = await supabase.rpc('get_dashboard_insights', { anchor_date: anchorDate });

        if (error) {
            console.error("RPC Error:", error);
            return;
        }

        console.log("RPC Result Summary:");
        console.log("- Winners count:", data.winners?.length || 0);
        console.log("- Losers count:", data.losers?.length || 0);
        console.log("- Categories count:", data.categories?.length || 0);

        if (data.winners && data.winners.length > 0) {
            console.log("\nTop Winner Sample:", data.winners[0]);
        } else {
            // If empty, let's analyze why current_year_sales might be empty in the RPC
            console.log("\nInsights returned empty. Checking raw sales counts in DB...");
            const { count: currCount } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true }).gte('date', '2026-01-01').lte('date', '2026-03-05');
            const { count: prevCount } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true }).gte('date', '2025-01-01').lte('date', '2025-03-06');
            console.log(`- Sales records in DB for 2026 period: ${currCount}`);
            console.log(`- Sales records in DB for 2025 period: ${prevCount}`);
        }

    } catch (e) { console.error(e); }
}

debugInsights();
