import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    let deleted = 0;
    while (true) {
        // Fetch a batch of IDs to delete
        const { data } = await supabase
            .from('daily_sales')
            .select('id')
            .gte('date', '2025-01-01')
            .lte('date', '2025-12-31')
            .limit(10000);

        if (!data || data.length === 0) break;

        const ids = data.map(d => d.id);
        const { error } = await supabase
            .from('daily_sales')
            .delete()
            .in('id', ids);

        if (error) {
            console.error("Batch delete error:", error);
            break;
        }

        deleted += ids.length;
        console.log(`Deleted ${deleted} rows so far...`);
    }

    // Delete '단종' products
    const { error: err2 } = await supabase
        .from('products')
        .delete()
        .eq('name', '단종');

    console.log("Deleted products:", err2 ? err2 : "Success");
    console.log("Done.");
}

run();
