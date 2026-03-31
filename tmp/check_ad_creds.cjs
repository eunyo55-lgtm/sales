const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkAdCreds() {
    console.log('Fetching app_settings...');
    const { data, error } = await supabase.from('app_settings').select('*');
    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log('Settings keys:', data.map(s => s.key));
    const access = data.find(s => s.key === 'COUPANG_AD_ACCESS_KEY');
    const secret = data.find(s => s.key === 'COUPANG_AD_SECRET_KEY');
    const customer = data.find(s => s.key === 'COUPANG_AD_CUSTOMER_ID');

    if (!access || !secret) {
        console.error('Ad Credentials missing in DB!');
        return;
    }

    console.log('Access Key starts with:', access.value.substring(0, 5));
    console.log('Customer ID:', customer ? customer.value : 'MISSING');
}

checkAdCreds();
