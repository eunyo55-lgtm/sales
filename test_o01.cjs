const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://vzyfygmzqqiwgrcuydti.supabase.co', 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh');

async function test() {
    try {
        const { data, error } = await supabase.from('products').select('barcode, current_stock, fc_stock, vf_stock, updated_at').eq('barcode', 'O01L12UOW140');
        if (error) console.error("Error:", error);
        console.log("Data:", data);

        // Also check daily_sales for this barcode
        const { data: sales } = await supabase.from('daily_sales').select('date, quantity, fc_quantity, vf_quantity').eq('barcode', 'O01L12UOW140').order('date', { ascending: false }).limit(10);
        console.log("Recent Sales:", sales);
    } catch (e) {
        console.error("Exception:", e);
    }
}
test().then(() => process.exit(0));
