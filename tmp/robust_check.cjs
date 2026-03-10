const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAll() {
    console.log("Attempting to find daily_sales or similar tables...");

    // 1. Try common variations
    const names = ['daily_sales', 'daily_sale', 'Sales', 'DAILY_SALES', 'coupang_sales'];
    for (const name of names) {
        const { error } = await supabase.from(name).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`[${name}] Error: ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`[${name}] SUCCESS! EXISTS.`);
        }
    }

    // 2. Try to use PostgREST RPC if any exist to list tables
    // (None known from local files, but maybe one exists in DB)
}

listAll();
