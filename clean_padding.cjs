const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('c:/Users/onlin/Desktop/Sales/.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function test() {
    const { data: sales, error } = await supabase.from('daily_sales')
        .select('created_at, quantity, stock, date')
        .eq('quantity', 0)
        .eq('fc_quantity', 0)
        .eq('vf_quantity', 0)
        .eq('stock', 0)
        .gte('created_at', '2026-02-23T06:40:00Z')
        .lt('created_at', '2026-02-23T07:00:00Z');

    if (error) {
        console.error(error);
        return;
    }
    console.log('Found padded rows:', sales.length);

    // Check how many we can safely delete
    if (sales.length > 0) {
        // We will execute a delete query
        const { error: delError } = await supabase.from('daily_sales')
            .delete()
            .eq('quantity', 0)
            .eq('fc_quantity', 0)
            .eq('vf_quantity', 0)
            .eq('stock', 0)
            .gte('created_at', '2026-02-23T06:40:00Z')
            .lt('created_at', '2026-02-23T07:00:00Z');

        console.log('Delete error:', delError);
        console.log('Padded rows deleted.');
    }
}
test();
