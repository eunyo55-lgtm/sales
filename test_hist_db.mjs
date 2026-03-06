import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: sales, error } = await supabase
        .from('daily_sales')
        .select('date, barcode, quantity')
        .eq('date', '2025-03-04');

    console.log("Sales in DB for 2025-03-04:", sales?.length);
    if (sales) {
        console.log("Total quantity in DB:", sales.reduce((sum, row) => sum + row.quantity, 0));
        console.log("Some barcodes in DB for that day:", sales.slice(0, 5).map(s => s.barcode));
    }

    // Also check total products count
    const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
    console.log("Total registered products:", productCount);
}

run();
