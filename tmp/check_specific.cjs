const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificBarcodes() {
    try {
        const barcodes = ['O37A12GPK00F', 'O37A14UBR00F', 'O37L12UOW180']; // Added one I know exists

        for (const bc of barcodes) {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('barcode', bc);
            console.log(`Checking [${bc}]: Found ${data?.length || 0} rows.`);
        }

    } catch (e) { console.error(e); }
}

checkSpecificBarcodes();
