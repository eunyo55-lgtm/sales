const fs = require('fs');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const functionUrl = `${supabaseUrl}/functions/v1/coupang-ad-proxy`;

async function testFunction() {
    console.log(`Pinging ${functionUrl}...`);
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-test': 'true'
            },
            body: JSON.stringify({})
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error(`Fetch error:`, e);
    }
}

testFunction();
