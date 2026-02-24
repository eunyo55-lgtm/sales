const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://vzyfygmzqqiwgrcuydti.supabase.co', 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh');

async function test() {
    try {
        const { data, error } = await supabase.from('daily_sales').select('*').gt('quantity', 0).order('date', { ascending: false }).limit(5);
        if (error) console.error("Error:", error);
        console.log("Data:", data);
    } catch (e) {
        console.error("Exception:", e);
    }
}
test().then(() => process.exit(0));
