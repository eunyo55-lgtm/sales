const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function countRecentSales() {
    try {
        const anchorDate = '2026-03-05';
        const sixtyDaysAgo = '2026-01-04'; // Approximately

        const { data, error } = await supabase
            .from('daily_sales')
            .select('barcode')
            .gte('date', sixtyDaysAgo)
            .lte('date', anchorDate);

        if (error) console.error(error);
        const uniqueBarcodes = new Set(data?.map(s => s.barcode));
        console.log(`Unique barcodes with sales in last 60 days: ${uniqueBarcodes.size}`);

        const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
        console.log(`Total Products in Master: ${totalProducts}`);

    } catch (e) { console.error(e); }
}

countRecentSales();
