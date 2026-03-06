const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKkukkkuSales() {
    try {
        const { data: products } = await supabase
            .from('products')
            .select('barcode, name')
            .ilike('name', '%꾸꾸%');

        if (!products || products.length === 0) return;

        const barcodes = products.map(p => p.barcode);
        const anchorDate = '2026-03-05';
        const sevenDaysAgo = '2026-02-26';

        const { data: sales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .in('barcode', barcodes)
            .gte('date', sevenDaysAgo)
            .lte('date', anchorDate);

        const salesMap = {};
        sales?.forEach(s => {
            salesMap[s.barcode] = (salesMap[s.barcode] || 0) + s.quantity;
        });

        console.log("'꾸꾸' 7-day sales (sum per barcode):");
        Object.entries(salesMap).forEach(([bc, qty]) => {
            const p = products.find(prod => prod.barcode === bc);
            console.log(`${p.name} (${bc}): ${qty}`);
        });

        // Also check top 10 products by 7-day sales in the whole DB
        const { data: top7dRPC } = await supabase.rpc('get_product_sales_stats', {
            anchor_date: anchorDate,
            limit_val: 20,
            offset_val: 0
        });
        // Note: RPC isn't sorted by 7d sales, it's sorted by barcode.
        // We need to fetch more or use a different tool.

        // Let's just use daily_sales group by
        const { data: globalTop } = await supabase
            .from('daily_sales')
            .select('barcode, quantity.sum()')
            .gte('date', sevenDaysAgo)
            .lte('date', anchorDate)
            .limit(20);
        // This might not work in postgrest easily for group by sum without a view or rpc.

    } catch (e) { console.error(e); }
}

checkKkukkkuSales();
