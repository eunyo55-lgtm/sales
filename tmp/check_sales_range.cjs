const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function getTotalSales(start, end) {
    let totalQty = 0;
    let totalRecords = 0;
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('daily_sales')
            .select('quantity')
            .gte('date', start)
            .lte('date', end)
            .range(from, from + step - 1);

        if (error) {
            console.error('Error fetching sales:', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            totalQty += data.reduce((sum, s) => sum + (s.quantity || 0), 0);
            totalRecords += data.length;
            from += step;
            if (data.length < step) hasMore = false;
        }
    }

    console.log(`Sales from ${start} to ${end}:`);
    console.log(`Total Quantity: ${totalQty}`);
    console.log(`Number of records: ${totalRecords}`);
    return totalQty;
}

async function run() {
    console.log('--- 2026 Check ---');
    await getTotalSales('2026-03-01', '2026-03-25');
    
    console.log('\n--- 2025 Check (YoY) ---');
    await getTotalSales('2025-03-02', '2025-03-26');
    
    console.log('\n--- 2024 Check (YoY) ---');
    await getTotalSales('2024-03-03', '2024-03-27');
}

run();
