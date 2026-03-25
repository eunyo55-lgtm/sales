import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function testRawData() {
    const { data, error } = await supabase.from('daily_sales')
        .select('date, quantity, fc_quantity, vf_quantity')
        .gte('date', '2026-03-23')
        .lte('date', '2026-03-23')
        .limit(10);
        
    if (error) throw error;
    console.log("Raw daily_sales data (2026-03-23):");
    console.log(data);
}

testRawData().catch(console.error);
