const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findKkukkku() {
    try {
        // 1. Search for "꾸꾸" in products
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .ilike('name', '%꾸꾸%');

        console.log("Products matching '꾸꾸':");
        console.log(JSON.stringify(products, null, 2));

        if (products && products.length > 0) {
            const barcodes = products.map(p => p.barcode);

            // 2. Check sales for these barcodes on 3/5
            const { data: sales } = await supabase
                .from('daily_sales')
                .select('*')
                .in('barcode', barcodes)
                .eq('date', '2026-03-05');

            console.log("Sales for '꾸꾸' on 3/5:");
            console.log(sales);

            // 3. Check if these barcodes are returned by the RPC (check first 1000)
            const { data: rpcStats } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: '2026-03-05',
                limit_val: 1000,
                offset_val: 0
            });
            const rpcHasIt = rpcStats?.some(s => barcodes.includes(s.barcode));
            console.log("Is '꾸꾸' in first 1000 of RPC?", rpcHasIt);
        } else {
            console.log("No product named '꾸꾸' found in products table.");

            // 3b. Search in daily_sales for high volume items not in products?
            // Actually, my sync logic should have added them. 
            // Let's check for barcodes with high sales on 3/5 that are "unregistered"
            const { data: topSales } = await supabase
                .from('daily_sales')
                .select('barcode, quantity')
                .eq('date', '2026-03-05')
                .order('quantity', { ascending: false })
                .limit(20);

            console.log("Top Sales on 3/5 from daily_sales:");
            console.log(topSales);
        }

    } catch (e) { console.error(e); }
}

findKkukkku();
