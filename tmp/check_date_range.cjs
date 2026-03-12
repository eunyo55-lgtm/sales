const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDateRange() {
    try {
        const { data: minMax, error } = await supabase
            .from('daily_sales')
            .select('date')
            .order('date', { ascending: false })
            .limit(10);

        console.log("Top 10 Latest Dates in daily_sales:");
        console.log(minMax);

        const { data: firstDates } = await supabase
            .from('daily_sales')
            .select('date')
            .order('date', { ascending: true })
            .limit(10);
        console.log("\nTop 10 Earliest Dates in daily_sales:");
        console.log(firstDates);

    } catch (e) { console.error(e); }
}

checkDateRange();
