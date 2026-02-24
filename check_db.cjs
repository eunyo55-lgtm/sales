const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: salesData } = await supabase.from('daily_sales').select('*').limit(5).order('date', { ascending: false });
    console.log("RECENT SALES ROWS:");
    console.log(salesData);

    const { data: prodData } = await supabase.from('products').select('barcode, current_stock, fc_stock, vf_stock').neq('current_stock', 0).limit(5);
    console.log("\nPRODUCTS WITH NON-ZERO STOCK:");
    console.log(prodData);
}

run();
