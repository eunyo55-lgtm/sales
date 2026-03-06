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
    let deletedCount = 0;
    while (true) {
        const { data: sales, error } = await supabase.from('daily_sales')
            .select('id')
            .eq('quantity', 0)
            .eq('fc_quantity', 0)
            .eq('vf_quantity', 0)
            .eq('stock', 0)
            .gte('created_at', '2026-02-23T06:40:00Z')
            .lt('created_at', '2026-02-23T07:00:00Z')
            .limit(1000);

        if (error) {
            console.error(error);
            break;
        }

        if (sales.length === 0) {
            console.log('No more padded rows found.');
            break;
        }

        const ids = sales.map(s => s.id);
        const { error: delError } = await supabase.from('daily_sales')
            .delete()
            .in('id', ids);

        if (delError) {
            console.log('Delete error:', delError);
            break;
        }
        deletedCount += ids.length;
        console.log(`Deleted ${deletedCount} rows so far...`);
    }
    console.log('Finished. Total deleted:', deletedCount);
}
test();
