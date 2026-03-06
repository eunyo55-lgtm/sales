import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('daily_sales')
        .select('date, quantity, barcode, fc_quantity, vf_quantity, stock')
        .limit(1);

    console.log("Result:", data, "Error:", error);
}

run();
