const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNumberBarcodes() {
    try {
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .ilike('barcode', '0%');
        console.log("Starting with 0:", count);

        const { count: countTotal } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
        console.log("Total products:", countTotal);

        // Check a sample of items around offset 2444
        const { data: sample } = await supabase
            .from('products')
            .select('barcode, name')
            .order('barcode')
            .range(2440, 2450);
        console.log("Sample at offset 2440-2450:");
        sample?.forEach((p, idx) => console.log(`${idx}: ${p.barcode} - ${p.name}`));

    } catch (e) { console.error(e); }
}

checkNumberBarcodes();
