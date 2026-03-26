const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function checkMalformed() {
    const { data: prods } = await supabase.from('products').select('barcode, name, season').limit(5000);
    
    let malformedCount = 0;
    let malformedSamples = [];
    
    prods.forEach(p => {
        const isMalformed = (p.season && (p.season.includes('<td') || p.season.includes('white-space'))) ||
                            (p.name && (p.name.includes('<td') || p.name.includes('white-space')));
        if (isMalformed) {
            malformedCount++;
            if (malformedSamples.length < 5) malformedSamples.push({ barcode: p.barcode, name: p.name, season: p.season });
        }
    });

    console.log(`Total products checked: ${prods.length}`);
    console.log(`Malformed products found: ${malformedCount}`);
    if (malformedSamples.length > 0) {
        console.log('Samples:', JSON.stringify(malformedSamples, null, 2));
    }
}

checkMalformed();
