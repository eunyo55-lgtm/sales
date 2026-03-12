import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function cleanup() {
    console.log("Cleaning up malformed Season data...");

    // 1. Delete the corrupted product with barcode S99742
    // The user said "This value is not in our data", and it looks like garbage.
    const delResponse = await fetch(`${URL}/rest/v1/products?barcode=eq.S99742`, {
        method: 'DELETE',
        headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    });

    if (delResponse.ok) {
        const deleted = await delResponse.json();
        console.log("Successfully deleted corrupted products:", deleted.length);
    } else {
        const err = await delResponse.text();
        console.error("Failed to delete S99742:", err);
    }

    // 2. Search for any other rows where season contains '<td' or 'white-space'
    const searchUrl = `${URL}/rest/v1/products?season=ilike.*%3Ctd*&select=barcode,name,season`;
    const searchResponse = await fetch(searchUrl, {
        headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
        }
    });

    if (searchResponse.ok) {
        const others = await searchResponse.json();
        console.log(`Found ${others.length} other malformed entries.`);
        for (const p of others) {
            console.log(`Fixing [${p.barcode}] ${p.name}...`);
            // Update season to '정보없음'
            await fetch(`${URL}/rest/v1/products?barcode=eq.${p.barcode}`, {
                method: 'PATCH',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ season: '정보없음' })
            });
        }
    }
}

cleanup();
