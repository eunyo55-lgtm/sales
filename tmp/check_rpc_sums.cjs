const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking discrepancy for: ${anchorDateStr}`);

    try {
        let offset = 0;
        let totalQtyYesterday = 0;
        let totalJsonQty = 0;
        let rowCount = 0;

        while (true) {
            const { data, error } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: 1000,
                offset_val: offset
            });
            if (error) { console.error(error); break; }
            if (!data || data.length === 0) break;

            data.forEach(s => {
                totalQtyYesterday += parseInt(s.qty_yesterday || 0);
                const jsonVal = (s.daily_sales && s.daily_sales[anchorDateStr]) || 0;
                totalJsonQty += parseInt(jsonVal);
            });
            rowCount += data.length;
            offset += 1000;
        }

        console.log(`Summary:`);
        console.log(`- Total Barcodes processed: ${rowCount}`);
        console.log(`- Sum of qty_yesterday field: ${totalQtyYesterday}`);
        console.log(`- Sum from daily_sales JSON[${anchorDateStr}]: ${totalJsonQty}`);

        // Compare with Dashboard's direct sum
        const { data: metrics } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDateStr });
        console.log(`- Dashboard (statYesterday): ${metrics.statYesterday}`);

    } catch (e) { console.error(e); }
}

check();
