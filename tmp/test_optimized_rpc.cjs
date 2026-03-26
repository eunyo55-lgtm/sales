const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testOptimizedRPC() {
    console.log('Testing Optimized RPC (V3)...');
    const { data, error } = await supabase.rpc('get_dashboard_combined_rankings_custom', {
        start_date: '2026-03-01',
        end_date: '2026-03-25',
        limit_val: 5,
        offset_val: 0
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Sample Results:', JSON.stringify(data, null, 2));
}

testOptimizedRPC();
