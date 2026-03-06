const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const anchorDateStr = '2026-03-05';
    console.log(`Checking internal consistency for: ${anchorDateStr}`);

    try {
        let offset = 0;
        let mismatchCount = 0;
        let totalRows = 0;

        while (true) {
            const { data, error } = await supabase.rpc('get_product_sales_stats', {
                anchor_date: anchorDateStr,
                limit_val: 1000,
                offset_val: offset
            });
            if (error) break;
            if (!data || data.length === 0) break;

            data.forEach(s => {
                const fieldVal = parseInt(s.qty_yesterday || 0);
                const jsonVal = (s.daily_sales && s.daily_sales[anchorDateStr]) || 0;
                if (fieldVal !== jsonVal) {
                    mismatchCount++;
                    if (mismatchCount <= 5) {
                        console.log(`Mismatch at ${s.barcode}: Field=${fieldVal}, JSON=${jsonVal}`);
                    }
                }
            });
            totalRows += data.length;
            offset += 1000;
        }

        console.log(`Summary:`);
        console.log(`- Total Barcodes checked: ${totalRows}`);
        console.log(`- Mismatches found: ${mismatchCount}`);

    } catch (e) { console.error(e); }
}

check();
