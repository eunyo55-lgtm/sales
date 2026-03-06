const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    // We can use an RPC to get estimated row count, but if we don't have one, we can do EXPLAIN, but we can't via PostgREST easily without an extension.
    // Let's just try to fetch count for a single day to see how many rows are there
    const { count } = await supabase.from('daily_sales').select('*', { count: 'exact', head: true }).eq('date', '2026-03-05');
    console.log(`Rows on 2026-03-05: ${count}`);

    // Let's also check the distinct dates
    // PostgREST doesn't support distinct easily on columns without a view or rpc, so let's just query a small range.
}
testFetch();
