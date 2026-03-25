import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function testQuery() {
    const { count, error } = await supabase.from('daily_sales')
        .select('*', { count: 'exact', head: true })
        .eq('date', '2026-03-23');
    console.log(`Row count for 2026-03-23: ${count}`);
    
    // Now fetch page 2 (offset 1000)
    const { data: page2, error: error2 } = await supabase.from('daily_sales')
        .select('date, quantity')
        .eq('date', '2026-03-23')
        .order('barcode')
        .range(1000, 1999);
        
    console.log(`Page 2 returned ${page2?.length} rows.`);
}

testQuery().catch(console.error);
