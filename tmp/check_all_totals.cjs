const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkTotals(start, end) {
    console.log(`Checking period: ${start} ~ ${end}`);

    // 1. Daily Sales Total
    let dsTotal = 0;
    let dsRows = 0;
    let from = 0;
    let hasMore = true;
    while(hasMore) {
        const { data } = await supabase.from('daily_sales').select('quantity').gte('date', start).lte('date', end).range(from, from+999);
        if(!data || data.length === 0) { hasMore = false; } else {
            dsTotal += data.reduce((s, r) => s + (r.quantity || 0), 0);
            dsRows += data.length;
            from += 1000;
            if(data.length < 1000) hasMore = false;
        }
    }
    console.log(`[daily_sales] Total Quantity: ${dsTotal.toLocaleString()} (${dsRows.toLocaleString()} rows)`);

    // 2. Coupang Orders Total
    let coOrderTotal = 0;
    let coConfirmedTotal = 0;
    let coRows = 0;
    from = 0;
    hasMore = true;
    while(hasMore) {
        const { data } = await supabase.from('coupang_orders').select('order_qty, confirmed_qty').gte('order_date', start).lte('order_date', end).range(from, from+999);
        if(!data || data.length === 0) { hasMore = false; } else {
            coOrderTotal += data.reduce((s, r) => s + (r.order_qty || 0), 0);
            coConfirmedTotal += data.reduce((s, r) => s + (r.confirmed_qty || 0), 0);
            coRows += data.length;
            from += 1000;
            if(data.length < 1000) hasMore = false;
        }
    }
    console.log(`[coupang_orders] Total Order Qty: ${coOrderTotal.toLocaleString()}`);
    console.log(`[coupang_orders] Total Confirmed Qty: ${coConfirmedTotal.toLocaleString()} (${coRows.toLocaleString()} rows)`);
}

checkTotals('2026-03-01', '2026-03-25');
