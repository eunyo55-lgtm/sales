import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Check daily_sales for 2024 or 2025
    const { count: count25 } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true }).gte('date', '2025-01-01').lte('date', '2025-12-31');
    const { count: count24 } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true }).gte('date', '2024-01-01').lte('date', '2024-12-31');

    console.log("2024 Sales Count:", count24);
    console.log("2025 Sales Count:", count25);

    // Let's also check '단종' products
    const { count: countDiscontinued } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('name', '단종');
    console.log("Discontinued Products Count:", countDiscontinued);
}

run();
