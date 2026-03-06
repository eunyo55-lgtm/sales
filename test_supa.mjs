import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: latestData, error: latestError } = await supabase
        .from('daily_sales')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

    console.log("Latest Date:", latestData, latestError);

    const { data: sales, error: salesError } = await supabase
        .from('daily_sales')
        .select('date, barcode, quantity')
        .order('date', { ascending: false })
        .limit(10);

    console.log("Recent 10 sales:", sales);
}

run();
