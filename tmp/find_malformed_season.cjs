const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findMalformedData() {
    console.log("Searching for malformed season data...");
    
    const { data: malformed, error } = await supabase
        .from('products')
        .select('barcode, name, season')
        .or('season.ilike.%<td%,season.ilike.%S99742%');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log(`Found ${malformed.length} malformed entries.`);
    malformed.forEach(p => {
        console.log(`- [${p.barcode}] ${p.name}: "${p.season}"`);
    });
}

findMalformedData();
