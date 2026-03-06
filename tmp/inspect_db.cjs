const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    try {
        // 1. Check some sample products from the screenshot
        const barcodes = ['045P01GIV130', '10,024', '10,140'];
        const { data: products } = await supabase.from('products').select('*').in('barcode', barcodes);
        console.log("Sample Products in DB:");
        console.log(JSON.stringify(products, null, 2));

        // 2. Check Jan 1-3 sales in daily_sales
        const { data: janSales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity, date')
            .gte('date', '2026-01-01')
            .lte('date', '2026-01-03')
            .limit(10);
        console.log("Sample Jan Sales:");
        console.log(janSales);

        // 3. Count rows in daily_sales for Jan 1-3
        const { count } = await supabase
            .from('daily_sales')
            .select('*', { count: 'exact', head: true })
            .gte('date', '2026-01-01')
            .lte('date', '2026-01-03');
        console.log(`Total rows for Jan 1-3: ${count}`);

    } catch (e) { console.error(e); }
}

inspect();
