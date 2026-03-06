const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    try {
        const anchorDateStr = '2026-03-05';
        console.log(`Diagnosing for: ${anchorDateStr}`);

        // 1. Total count of products in master
        const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
        console.log(`Total Products in DB: ${totalProducts}`);

        // 2. Fetch ALL rows from RPC and count
        let offset = 0;
        let totalRPCRows = 0;
        let kkukkkuFound = 0;
        let totalSales305 = 0;
        let totalYearlySales = 0;

        while (true) {
            const { data, error } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: 1000,
                offset_val: offset
            });
            if (error) { console.error("RPC Error:", error); break; }
            if (!data || data.length === 0) break;

            data.forEach(s => {
                totalRPCRows++;
                totalSales305 += Number(s.qty_yesterday || 0);
                totalYearlySales += Number(s.qty_year || 0);
                if (s.barcode.includes('O01L12U')) {
                    kkukkkuFound++;
                }
            });

            if (data.length < 1000) break;
            offset += 1000;
        }

        console.log(`\nRPC Execution Results:`);
        console.log(`- Total Rows returned by RPC: ${totalRPCRows}`);
        console.log(`- Total Sales for 3/5: ${totalSales305}`);
        console.log(`- Total Cumulative Sales: ${totalYearlySales}`);
        console.log(`- '꾸꾸'-like items found: ${kkukkkuFound}`);

        // 3. Sample a "꾸꾸" item directly
        const bc = 'O01L12UOW180';
        const { data: salesSample } = await supabase
            .from('daily_sales')
            .select('date, quantity')
            .eq('barcode', bc)
            .gte('date', '2026-01-01')
            .lte('date', '2026-01-05');
        console.log(`\nSales Sample for ${bc} (Jan 1-5):`);
        console.log(salesSample);

    } catch (e) { console.error(e); }
}

diagnose();
