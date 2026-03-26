const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkRPCSignature() {
    console.log('--- Calling get_dashboard_combined_rankings_custom (V3) ---');
    const { data, error } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-01',
        end_date: '2026-03-25',
        limit_val: 1,
        offset_val: 0
    });

    if (error) {
        console.error('RPC Error:', error.message);
        if (error.message.includes('Could not find')) {
            console.log('Function NOT FOUND or signature mismatch.');
        }
        return;
    }

    if (data && data.length > 0) {
        const first = data[0];
        console.log('Return columns:', Object.keys(first));
        console.log('Sample row:', JSON.stringify(first, null, 2));
    } else {
        console.log('No data returned.');
    }
}

checkRPCSignature();
