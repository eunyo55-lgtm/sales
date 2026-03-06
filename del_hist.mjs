import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Delete newly uploaded 2025 daily_sales (using date range to be safe)
    console.log("Deleting 2025 sales...");
    const { error: err1 } = await supabase
        .from('daily_sales')
        .delete()
        .gte('date', '2025-01-01')
        .lte('date', '2025-12-31');
    console.log("Sales deletion error:", err1);

    console.log("Deleting '단종' products...");
    const { error: err2 } = await supabase
        .from('products')
        .delete()
        .eq('name', '단종');
    console.log("Products deletion error:", err2);

    console.log("Done.");
}

run();
