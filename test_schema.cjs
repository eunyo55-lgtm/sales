require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data } = await supabase.from('products').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("COLUMNS: ", Object.keys(data[0]));
    } else {
        console.log("No data");
    }
    process.exit(0);
}
run();
