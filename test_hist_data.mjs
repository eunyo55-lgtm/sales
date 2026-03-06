import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: sales, error } = await supabase
        .from('daily_sales')
        .select('date, barcode, quantity')
        .eq('date', '2025-03-04');

    console.log("Sales for 2025-03-04:", sales?.length, error);

    if (sales) {
        const total = sales.reduce((sum, row) => sum + row.quantity, 0);
        console.log("Total quantity for 2025-03-04:", total);
    }
}

run();
