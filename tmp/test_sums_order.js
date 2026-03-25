import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function testRawData() {
    let allData = [];
    let i = 0;
    const BATCH = 5000;
    let isDone = false;
    while (!isDone) {
        const { data, error } = await supabase.from('daily_sales')
            .select('date, quantity')
            .gte('date', '2026-03-20')
            .lte('date', '2026-03-24')
            .order('date', { ascending: true })
            .order('barcode', { ascending: true })
            .range(i, i + BATCH - 1);
        
        if (error) throw error;
        if (data && data.length > 0) allData.push(...data);
        if (!data || data.length < BATCH) isDone = true;
        i += BATCH;
    }
    
    console.log(`Fetched ${allData.length} total rows`);
    const sums = {};
    for (const d of allData) {
        if (!sums[d.date]) sums[d.date] = { qty: 0 };
        sums[d.date].qty += (d.quantity || 0);
    }
    console.log("Sums:");
    console.log(sums);
}

testRawData().catch(console.error);
