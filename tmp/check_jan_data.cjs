const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJanData() {
    try {
        console.log("Checking for Jan 1-3 data in daily_sales...");
        const { data, count } = await supabase
            .from('daily_sales')
            .select('date, quantity', { count: 'exact' })
            .gte('date', '2026-01-01')
            .lte('date', '2026-01-03');

        console.log(`Found ${count} rows between 2026-01-01 and 2026-01-03.`);
        if (data && data.length > 0) {
            const sum = data.reduce((s, r) => s + r.quantity, 0);
            console.log(`Total Sales Quantity: ${sum}`);
            console.log("Sample rows:", data.slice(0, 5));
        }

        // Also check if they are in the '2025' range if maybe they were uploaded there?
        const { count: count25 } = await supabase
            .from('daily_sales')
            .select('*', { count: 'exact', head: true })
            .gte('date', '2025-01-01')
            .lte('date', '2025-01-03');
        console.log(`Found ${count25} rows between 2025-01-01 and 2025-01-03.`);

    } catch (e) { console.error(e); }
}

checkJanData();
