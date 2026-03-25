import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function testFilter() {
    console.time('FetchRange');
    const s = '2026-02-21';
    const e = '2026-03-23';
    
    let allData = [];
    let i = 0;
    const BATCH = 1000;
    let isDone = false;
    while (!isDone) {
        const { data, error } = await supabase.from('daily_sales')
            .select('date, quantity')
            .gte('date', s)
            .lte('date', e)
            .gt('quantity', 0)
            .order('date', { ascending: true })
            .order('barcode', { ascending: true })
            .range(i, i + BATCH - 1);
        
        if (error) throw error;
        if (data && data.length > 0) allData.push(...data);
        if (!data || data.length < BATCH) isDone = true;
        i += BATCH;
    }
    console.timeEnd('FetchRange');
    
    console.log(`Fetched ${allData.length} rows > 0 for 30 days`);
    
    // Check 2026-03-23 sum
    const sum23 = allData.filter(d => d.date.startsWith('2026-03-23')).reduce((acc, curr) => acc + curr.quantity, 0);
    console.log(`Sum for 03-23: ${sum23}`);
}

testFilter().catch(console.error);
