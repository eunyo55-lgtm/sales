const { createClient } = require('@supabase/supabase-js');

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function check() {
    const { count, error } = await supabase.from('daily_sales')
        .select('*', { count: 'exact', head: true })
        .eq('date', '2026-03-24');
    if (error) throw error;
    console.log(`Count for 2026-03-24: ${count}`);
}

check().catch(console.error);
