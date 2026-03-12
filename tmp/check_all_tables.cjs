const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    const tables = ['products', 'daily_sales', 'keywords', 'keyword_rankings', 'keyword_search_volumes'];
    for (const name of tables) {
        const { error } = await supabase.from(name).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`[${name}] MISSING or ERROR: ${error.message} (${error.code})`);
        } else {
            console.log(`[${name}] EXISTS.`);
        }
    }
}

checkAll();
