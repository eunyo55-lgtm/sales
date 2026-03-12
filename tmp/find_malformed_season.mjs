import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findMalformedData() {
    console.log("Searching for malformed season data...");
    
    // Search for strings containing HTML tags or the specific fragment
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
    
    if (malformed.length > 0) {
        console.log("\nTop 5 samples:");
        malformed.slice(0, 5).forEach(p => console.log(p));
    }
}

findMalformedData();
