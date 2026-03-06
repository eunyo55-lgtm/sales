import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const months = [
        { m: '01', d: '31' }, { m: '02', d: '28' }, { m: '03', d: '31' },
        { m: '04', d: '30' }, { m: '05', d: '31' }, { m: '06', d: '30' },
        { m: '07', d: '31' }, { m: '08', d: '31' }, { m: '09', d: '30' },
        { m: '10', d: '31' }, { m: '11', d: '30' }, { m: '12', d: '31' }
    ];
    for (const { m, d } of months) {
        console.log(`Deleting 2025-${m}...`);
        const { error } = await supabase
            .from('daily_sales')
            .delete()
            .gte('date', `2025-${m}-01`)
            .lte('date', `2025-${m}-${d}`);
        if (error) console.error(`Error ${m}:`, error);
    }

    console.log("Deleting '단종' products...");
    const { error: err2 } = await supabase
        .from('products')
        .delete()
        .eq('name', '단종');

    console.log("Deleted products:", err2 ? err2 : "Success");
    console.log("Done.");
}

run();
