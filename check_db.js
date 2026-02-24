require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data: sales, error: sErr } = await supabase.from('daily_sales').select('*').limit(5);
    console.log("Sales Error:", sErr);
    console.log("Sample Sales:", sales);

    const { data: prods, error: pErr } = await supabase.from('products').select('*').limit(5);
    console.log("Prods Error:", pErr);
    console.log("Sample Prods:", prods);

    const { count: sCount } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true });
    console.log("Total Sales:", sCount);

    const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    console.log("Total Prods:", pCount);
}
checkDb();
