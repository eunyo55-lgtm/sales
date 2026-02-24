const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data: sales, error: sErr } = await supabase.from('daily_sales').select('date, quantity, barcode, fc_quantity, vf_quantity').limit(1);
    console.log("Sales Error:", sErr?.message || 'none');

    const { data: prods, error: pErr } = await supabase.from('products').select('barcode, name, hq_stock, fc_stock, vf_stock, current_stock').limit(1);
    console.log("Prods Error:", pErr?.message || 'none');
}

checkDb();
