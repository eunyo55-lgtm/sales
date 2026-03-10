const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing connection to:", supabaseUrl);
    const { data, error } = await supabase.from('products').select('barcode').limit(1);
    if (error) {
        console.error("Connection failed:", error);
    } else {
        console.log("Connection successful!");
        console.log("Sample product barcode:", data[0]?.barcode);
    }
}

test();
