const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking data for: ${anchorDateStr}`);

    try {
        // 1. Dashboard Metrics
        const { data: metrics, error: e1 } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDateStr });
        if (e1) console.error("Error in get_dashboard_metrics:", e1);
        else console.log("Dashboard Yesterday Sales (statYesterday):", metrics.statYesterday);

        // 2. Product Sales Stats (What Product Status tab uses)
        const { data: stats, error: e2 } = await supabase.rpc('get_product_sales_stats', { anchor_date: anchorDateStr });
        if (e2) console.error("Error in get_product_sales_stats:", e2);
        else {
            const rpcTotal = stats.reduce((sum, s) => sum + parseInt(s.qty_yesterday || 0), 0);
            console.log(`RPC get_product_sales_stats Total (qty_yesterday): ${rpcTotal} across ${stats.length} barcodes`);

            // 3. Get Products Table
            const { data: products, error: e3 } = await supabase.from('products').select('barcode');
            const productBarcodes = new Set(products.map(p => p.barcode));
            console.log(`Products table has ${products.length} barcodes`);

            // 4. Calculate total for barcodes existing in products table
            const statsInProducts = stats.filter(s => productBarcodes.has(s.barcode));
            const totalInProducts = statsInProducts.reduce((sum, s) => sum + parseInt(s.qty_yesterday || 0), 0);
            console.log(`Total Sales for Barcodes in Products table: ${totalInProducts} (${statsInProducts.length} barcodes)`);

            // 5. Calculate total for barcodes MISSING from products table
            const statsMissingFromProducts = stats.filter(s => !productBarcodes.has(s.barcode));
            const totalMissingFromProducts = statsMissingFromProducts.reduce((sum, s) => sum + parseInt(s.qty_yesterday || 0), 0);
            console.log(`Total Sales for Barcodes MISSING from Products table: ${totalMissingFromProducts} (${statsMissingFromProducts.length} barcodes)`);

            if (statsMissingFromProducts.length > 0) {
                console.log("Sample missing barcodes:", statsMissingFromProducts.slice(0, 5).map(s => `${s.barcode}: ${s.qty_yesterday}`));
            }
        }

        // 6. Direct sum from daily_sales
        const { data: directSales, error: e4 } = await supabase
            .from('daily_sales')
            .select('quantity')
            .eq('date', anchorDateStr);
        if (e4) console.error("Error in direct daily_sales fetch:", e4);
        else {
            const directTotal = directSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
            console.log(`Direct daily_sales Total for ${anchorDateStr}: ${directTotal} across ${directSales.length} rows`);
        }

    } catch (e) {
        console.error("Catch:", e);
    }
}

check();
