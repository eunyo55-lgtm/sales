const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFinal() {
    try {
        const anchorDateStr = '2026-03-05';

        // Simulate api.getProductStats logic
        const { data: productsMaster } = await supabase.from('products').select('*');
        const { data: salesStats } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr, limit_val: 10000, offset_val: 0 }); // Fetch enough

        const statsMap = new Map();
        salesStats?.forEach(s => statsMap.set(s.barcode, s));

        const processed = productsMaster.map(p => {
            const st = statsMap.get(p.barcode) || {};
            return {
                name: p.name,
                barcode: p.barcode,
                sales7Days: Number(st.qty_7d || 0),
                totalSales: Number(st.qty_year || 0)
            };
        });

        // Simulate Grouping
        const groups = new Map();
        processed.forEach(p => {
            const existing = groups.get(p.name);
            if (existing) {
                existing.sales7Days += p.sales7Days;
                existing.totalSales += p.totalSales;
            } else {
                groups.set(p.name, { name: p.name, sales7Days: p.sales7Days, totalSales: p.totalSales });
            }
        });

        const sorted = Array.from(groups.values()).sort((a, b) => b.totalSales - a.totalSales);

        console.log("Top 5 Groups by Total Sales:");
        sorted.slice(0, 5).forEach((g, idx) => {
            console.log(`${idx + 1}: ${g.name} - Total Sales: ${g.totalSales}`);
        });

        const kkukkku = sorted.find(g => g.name.includes('꾸꾸'));
        console.log("\nKkukkku Group Stats:");
        console.log(kkukkku);

    } catch (e) { console.error(e); }
}

verifyFinal();
