import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = createClient(supaUrl, supaKey);

async function testRpc() {
    // Current anchor date from the Dashboard Analytics
    const { data: latestData, error: latestError } = await supabase
        .from('daily_sales')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();
        
    const anchorDateStr = latestData.date.substring(0, 10);
    console.log(`Anchor Date: ${anchorDateStr}`);

    const { data: metrics, error } = await supabase.rpc('get_dashboard_metrics', { anchor_date: anchorDateStr });
    if (error) throw error;
    
    console.log("Metrics payload:");
    console.log(metrics);
    
    const { data: trends, error: error2 } = await supabase.rpc('get_dashboard_trends', { anchor_date: anchorDateStr });
    console.log("Trends payload (daily last 5):");
    console.log(trends?.daily?.slice(-5));
}

testRpc().catch(console.error);
