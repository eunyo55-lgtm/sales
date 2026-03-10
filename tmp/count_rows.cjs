const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function count() {
    const { count: pCount, error: pErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: sCount, error: sErr } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true });

    console.log("Products count:", pCount, "Error:", pErr);
    console.log("Daily Sales count:", sCount, "Error:", sErr);

    if (sCount > 0) {
        const { data: latest, error: lErr } = await supabase.from('daily_sales').select('date').order('date', { ascending: false }).limit(1).single();
        console.log("Latest date in daily_sales:", latest?.date, "Error:", lErr);
    }
}

count();
