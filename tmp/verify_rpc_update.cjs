const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testPagination() {
    console.log('Testing RPC pagination support...');
    
    // Call with offset 0
    const res0 = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-01',
        end_date: '2026-03-25',
        limit_val: 5,
        offset_val: 0
    });
    
    if (res0.error) {
        console.log('RPC Call (offset 0) failed:', res0.error.message);
        return;
    }
    const first5 = res0.data.map(r => r.barcode);
    console.log('First 5 barcodes:', first5);

    // Call with offset 5
    const res5 = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-01',
        end_date: '2026-03-25',
        limit_val: 5,
        offset_val: 5
    });

    if (res5.error) {
        console.log('RPC Call (offset 5) failed:', res5.error.message);
        return;
    }
    const next5 = res5.data.map(r => r.barcode);
    console.log('Next 5 barcodes:', next5);

    const isDifferent = first5.some((b, i) => b !== next5[i]);
    console.log(`Pagination working: ${isDifferent}`);
}

testPagination();
