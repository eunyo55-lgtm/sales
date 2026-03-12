const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables'); // If a helper RPC exists
    if (error) {
        // Fallback: system query
        const { data: tables, error: tErr } = await supabase
            .from('pg_tables') // This might not work via PostgREST unless exposed
            .select('tablename')
            .eq('schemaname', 'public');

        if (tErr) {
            console.log("Could not list tables via PostgREST. Trying a generic query on a known table.");
            const { data: p, error: pErr } = await supabase.from('products').select('*').limit(1);
            console.log("Products table exists:", !!p, pErr?.message);

            const { data: d, error: dErr } = await supabase.from('daily_sales').select('*').limit(1);
            console.log("Daily Sales table exists:", !!d, dErr?.message);
        } else {
            console.log("Tables in public schema:", tables.map(t => t.tablename));
        }
    } else {
        console.log("Tables:", data);
    }
}

listTables();
