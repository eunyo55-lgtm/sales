const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBarcodeChars() {
    try {
        // 1. Get barcode from products
        const { data: pData } = await supabase.from('products').select('barcode').ilike('name', '%꾸꾸%').limit(1);
        const pBc = pData?.[0]?.barcode;
        console.log(`Product Barcode: [${pBc}] (Length: ${pBc?.length})`);

        // 2. Get barcode from daily_sales that "looks like" it
        const { data: sData } = await supabase.from('daily_sales').select('barcode').ilike('barcode', '%01L12U%').limit(1);
        const sBc = sData?.[0]?.barcode;
        console.log(`Sales Barcode:   [${sBc}] (Length: ${sBc?.length})`);

        if (pBc && sBc) {
            console.log(`Are they identical? ${pBc === sBc}`);
            for (let i = 0; i < Math.max(pBc.length, sBc.length); i++) {
                if (pBc[i] !== sBc[i]) {
                    console.log(`Mismatch at index ${i}: Product='${pBc[i]}' (${pBc.charCodeAt(i)}), Sales='${sBc[i]}' (${sBc.charCodeAt(i)})`);
                }
            }
        }

    } catch (e) { console.error(e); }
}

checkBarcodeChars();
