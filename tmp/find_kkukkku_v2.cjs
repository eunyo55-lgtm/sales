const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findKkukkku() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('barcode, name, current_stock')
            .ilike('name', '%꾸꾸%');

        if (error) {
            console.error("Error fetching products:", error);
            return;
        }

        console.log(`Found ${products?.length || 0} products matching '꾸꾸':`);
        products?.forEach(p => {
            console.log(`Barcode: ${p.barcode}, Name: ${p.name}, Stock: ${p.current_stock}`);
        });

        if (products && products.length > 0) {
            const firstBarcode = products[0].barcode;
            const { data: sales } = await supabase
                .from('daily_sales')
                .select('barcode, quantity, date')
                .eq('barcode', firstBarcode)
                .gte('date', '2026-03-01')
                .lte('date', '2026-03-05');
            console.log(`Sales for ${firstBarcode} recently:`, sales);
        }
    } catch (e) { console.error(e); }
}

findKkukkku();
