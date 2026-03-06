const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTopYearly() {
    try {
        const barcodes = ['045P01GIV130', '045P01GIV140'];
        const anchorDate = '2026-03-05';

        const { data: sales } = await supabase
            .from('daily_sales')
            .select('barcode, quantity')
            .in('barcode', barcodes)
            .gte('date', '2026-01-01')
            .lte('date', anchorDate);

        const sums = {};
        sales?.forEach(s => {
            sums[s.barcode] = (sums[s.barcode] || 0) + s.quantity;
        });
        console.log("045P Yearly Sums:", sums);

    } catch (e) { console.error(e); }
}

checkTopYearly();
