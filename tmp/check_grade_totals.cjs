const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking Grade A bias for: ${anchorDateStr}`);

    try {
        // 1. Fetch all RPC results (all barcodes)
        let offset = 0;
        const allStats = [];
        while (true) {
            const { data } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: 1000,
                offset_val: offset
            });
            if (!data || data.length === 0) break;
            allStats.push(...data);
            offset += 1000;
        }

        // 2. Fetch all products (master)
        const productsMap = new Map();
        let i = 0;
        while (true) {
            const { data } = await supabase.from('products').select('barcode, current_stock').range(i, i + 999);
            if (!data || data.length === 0) break;
            data.forEach(p => productsMap.set(p.barcode, p));
            i += 1000;
        }

        // 3. Calculate Grade A (Based on sales7Days)
        allStats.sort((a, b) => (b.qty_7d || 0) - (a.qty_7d || 0));
        const totalSales7Days = allStats.reduce((sum, s) => sum + (s.qty_7d || 0), 0);
        let cumulativeSales = 0;

        const gradeA = [];
        allStats.forEach(s => {
            if ((s.qty_7d || 0) <= 0) return;
            cumulativeSales += (s.qty_7d || 0);
            if ((cumulativeSales / totalSales7Days) <= 0.20) {
                gradeA.push(s);
            }
        });

        // 4. Summarize
        const sumAll = allStats.reduce((acc, s) => {
            const p = productsMap.get(s.barcode) || { current_stock: 0 };
            return {
                yesterday: acc.yesterday + parseInt(s.qty_yesterday || 0),
                cumulative: acc.cumulative + parseInt(s.qty_year || 0),
                stock: acc.stock + (p.current_stock || 0)
            };
        }, { yesterday: 0, cumulative: 0, stock: 0 });

        const sumA = gradeA.reduce((acc, s) => {
            const p = productsMap.get(s.barcode) || { current_stock: 0 };
            return {
                yesterday: acc.yesterday + parseInt(s.qty_yesterday || 0),
                cumulative: acc.cumulative + parseInt(s.qty_year || 0),
                stock: acc.stock + (p.current_stock || 0)
            };
        }, { yesterday: 0, cumulative: 0, stock: 0 });

        console.log(`Results:`);
        console.log(`ALL Products (${allStats.length}):`);
        console.log(`- 3/5 Sales: ${sumAll.yesterday}`);
        console.log(`- Cumulative: ${sumAll.cumulative}`);
        console.log(`- Stock: ${sumAll.stock}`);

        console.log(`GRADE A Products (${gradeA.length}):`);
        console.log(`- 3/5 Sales: ${sumA.yesterday}`);
        console.log(`- Cumulative: ${sumA.cumulative}`);
        console.log(`- Stock: ${sumA.stock}`);

    } catch (e) { console.error(e); }
}

check();
