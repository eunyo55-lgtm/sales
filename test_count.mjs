import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { count, error } = await supabase
        .from('daily_sales')
        .select('*', { count: 'exact', head: true });

    console.log("Count:", count, "Error:", error);
}

run();
