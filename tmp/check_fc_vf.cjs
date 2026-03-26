const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkFCVF() {
    let totalQty = 0;
    let totalFC = 0;
    let totalVF = 0;
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data } = await supabase.from('daily_sales')
            .select('quantity, fc_quantity, vf_quantity')
            .gte('date', '2026-03-01')
            .lte('date', '2026-03-25')
            .range(from, from + step - 1);

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            totalQty += data.reduce((s, r) => s + (r.quantity || 0), 0);
            totalFC += data.reduce((s, r) => s + (r.fc_quantity || 0), 0);
            totalVF += data.reduce((s, r) => s + (r.vf_quantity || 0), 0);
            from += step;
            if (data.length < step) hasMore = false;
        }
        if (from > 300000) break;
    }

    console.log(`Summary for 2026-03-01 ~ 2026-03-25:`);
    console.log(`Sum of 'quantity' column: ${totalQty.toLocaleString()}`);
    console.log(`Sum of 'fc_quantity': ${totalFC.toLocaleString()}`);
    console.log(`Sum of 'vf_quantity': ${totalVF.toLocaleString()}`);
    console.log(`Sum of FC + VF: ${(totalFC + totalVF).toLocaleString()}`);
}

checkFCVF();
