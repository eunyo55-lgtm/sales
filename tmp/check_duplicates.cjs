const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkDuplicates() {
    console.log('Checking for duplicates in daily_sales (date, barcode)...');
    
    // We'll group by date, barcode and look for count > 1
    // Since I can't use complex GROUP BY in simple select, I'll sample a busy day.
    const date = '2026-03-20';
    const { data, error } = await supabase
        .from('daily_sales')
        .select('barcode, quantity')
        .eq('date', date);

    if (error) { console.error(error); return; }

    const counts = new Map();
    data.forEach(r => counts.set(r.barcode, (counts.get(r.barcode) || 0) + 1));
    
    let dups = 0;
    counts.forEach((c, b) => {
        if (c > 1) {
            dups++;
            // if(dups < 5) console.log(`Duplicate found for ${b}: ${c} records`);
        }
    });

    console.log(`Date: ${date}`);
    console.log(`Total records: ${data.length}`);
    console.log(`Duplicate barcodes on this date: ${dups}`);
}

checkDuplicates();
