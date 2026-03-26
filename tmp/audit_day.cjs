const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function auditDay(date) {
    console.log(`Auditing day: ${date}`);
    let totalQty = 0;
    let records = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data } = await supabase.from('daily_sales')
            .select('barcode, quantity')
            .eq('date', date)
            .range(from, from + step - 1);

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            records.push(...data);
            totalQty += data.reduce((s, r) => s + (r.quantity || 0), 0);
            from += step;
            if (data.length < step) hasMore = false;
        }
    }

    console.log(`Total Records: ${records.length}`);
    console.log(`Total Quantity: ${totalQty}`);

    const counts = new Map();
    records.forEach(r => counts.set(r.barcode, (counts.get(r.barcode) || 0) + 1));
    
    let dups = 0;
    counts.forEach((c, b) => { if (c > 1) dups++; });
    console.log(`Duplicate Barcodes: ${dups}`);
}

auditDay('2026-03-20');
