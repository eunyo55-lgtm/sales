const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debugSales() {
    console.log("Checking latest data date...");
    const { data: latestData } = await supabase.from('daily_sales').select('date').order('date', { ascending: false }).limit(1).single();
    const anchorDate = latestData ? latestData.date : new Date().toISOString().split('T')[0];
    console.log("Anchor Date:", anchorDate);

    console.log("Running get_product_sales_stats RPC...");
    const { data, error } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDate, limit_val: 5 });

    if (error) {
        console.error("RPC Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No data returned from RPC.");
        return;
    }

    console.log("Sample Data (First 2 items):");
    data.slice(0, 2).forEach(item => {
        console.log(`Barcode: ${item.barcode}`);
        console.log(`qty_week: ${item.qty_week}`);
        console.log(`qty_week_prev_week: ${item.qty_week_prev_week}`);
        console.log(`qty_7d: ${item.qty_7d}`);
        console.log("---");
    });
}

debugSales();
