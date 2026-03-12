const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOffset() {
    try {
        const targetBarcode = 'O01L12UOW180';

        // Count how many barcodes are "less than" this one
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .lt('barcode', targetBarcode);

        console.log(`Count of products before ${targetBarcode}: ${count}`);

        const { count: total } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
        console.log(`Total products: ${total}`);

    } catch (e) { console.error(e); }
}

checkOffset();
