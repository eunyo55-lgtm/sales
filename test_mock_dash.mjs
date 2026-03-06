import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function _fetchAllParallel(table, select, order) {
    const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    if (count === 0) return [];

    const total = count || 1000000;
    const BATCH_SIZE = 1000;
    const allData = [];

    for (let i = 0; i < total; i += BATCH_SIZE) {
        let q = supabase.from(table).select(select).range(i, i + BATCH_SIZE - 1);
        if (order) q = q.order(order);

        try {
            const { data, error } = await q;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData.push(...data);
            if (data.length < BATCH_SIZE) break;
        } catch (err) {
            throw err;
        }
    }
    return allData;
}

async function getDashboardAnalytics() {
    const { data: latestData, error: latestError } = await supabase
        .from('daily_sales')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

    if (latestError && latestError.code !== 'PGRST116') throw latestError;
    if (!latestData) return null;

    const anchorDateStr = latestData.date.substring(0, 10);
    const anchorDate = new Date(anchorDateStr);

    const shiftDate = (baseDateStr, days) => {
        const d = new Date(baseDateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const currentYear = anchorDateStr.substring(0, 4);
    const startOfYear = `${currentYear}-01-01`;
    const startOfMonth = `${anchorDateStr.substring(0, 7)}-01`;

    const dayOfWeek = anchorDate.getDay();
    const diffToFri = (dayOfWeek + 2) % 7;
    const startOfWeekStr = shiftDate(anchorDateStr, -diffToFri);

    const sales = await _fetchAllParallel('daily_sales', 'date, quantity, barcode, fc_quantity, vf_quantity, stock', 'date');
    const products_all = await _fetchAllParallel('products', 'barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock, fc_stock, vf_stock', 'barcode');

    // We stop here just to see if the fetching passes. 
    console.log("Sales fetched:", sales.length);
    console.log("Products fetched:", products_all.length);
}

getDashboardAnalytics().then(() => console.log("DONE")).catch(e => console.error("ERROR", e));
