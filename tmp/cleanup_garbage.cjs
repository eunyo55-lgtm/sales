const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    try {
        // Find products where name matches barcode OR name is '미등록 상품'
        // AND current_stock is 0
        const { data: toDelete, error } = await supabase
            .from('products')
            .select('barcode, name, current_stock')
            .or(`name.eq.미등록 상품,name.eq.barcode`) // barcode eq is not possible here directly, will check in JS
            .eq('current_stock', 0);

        if (error) console.error(error);

        // Filter in JS to find name == barcode
        const realDelete = toDelete?.filter(p => p.name === '미등록 상품' || p.name === p.barcode);

        console.log(`Found ${realDelete?.length || 0} garbage items to delete.`);

        if (realDelete && realDelete.length > 0) {
            const barcodes = realDelete.map(p => p.barcode);
            const CHUNK = 500;
            for (let i = 0; i < barcodes.length; i += CHUNK) {
                const { error: delErr } = await supabase
                    .from('products')
                    .delete()
                    .in('barcode', barcodes.slice(i, i + CHUNK));
                if (delErr) console.error(delErr);
            }
            console.log("Cleanup complete.");
        }

    } catch (e) { console.error(e); }
}

cleanup();
