const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testMetrics() {
    const anchorDate = '2026-03-25';
    console.log(`Testing get_dashboard_metrics for anchor_date: ${anchorDate}`);
    
    const { data, error } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDate });
    
    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Result:', JSON.stringify(data, null, 2));
}

testMetrics();
