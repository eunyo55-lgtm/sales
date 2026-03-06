import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    for (const m of months) {
        console.log(`Deleting 2025-${m}...`);
        const { error } = await supabase
            .from('daily_sales')
            .delete()
            .gte('date', `2025-${m}-01`)
            .lte('date', `2025-${m}-31`);
        if (error) console.error(`Error ${m}:`, error);
    }

    console.log("Deleting '단종' products...");
    const { error: err2 } = await supabase
        .from('products')
        .delete()
        .eq('name', '단종');

    console.log("Deleted products:", err2 ? err2 : "Success");
    console.log("Done.");
}

run();
