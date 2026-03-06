const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function renameUnregistered() {
    try {
        console.log("Renaming '미등록 상품' to barcode to avoid grouping...");

        // 1. Find all with name '미등록 상품'
        const { data: items } = await supabase
            .from('products')
            .select('barcode, name')
            .eq('name', '미등록 상품');

        console.log(`Found ${items?.length || 0} items named '미등록 상품'.`);

        if (items && items.length > 0) {
            const CHUNK = 100;
            for (let i = 0; i < items.length; i += CHUNK) {
                const chunk = items.slice(i, i + CHUNK);
                const updates = chunk.map(item => ({
                    barcode: item.barcode,
                    name: item.barcode // Using barcode as name
                }));

                const { error } = await supabase
                    .from('products')
                    .upsert(updates);

                if (error) console.error("Update error:", error);
            }
            console.log("Renaming complete.");
        }

    } catch (e) { console.error(e); }
}

renameUnregistered();
