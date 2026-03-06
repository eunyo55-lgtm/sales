import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function _fetchAllParallel(table, select, order) {
    const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("COUNT ERROR", countError);
        throw countError;
    }

    const total = count || 1000000;
    const BATCH_SIZE = 1000;
    const allData = [];

    for (let i = 0; i < total; i += BATCH_SIZE) {
        let q = supabase.from(table).select(select).range(i, i + BATCH_SIZE - 1);
        if (order) q = q.order(order);

        const { data, error } = await q;
        if (error) {
            console.error("FETCH ERROR in table", table, error);
            throw error;
        }
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < BATCH_SIZE) break;
    }
    return allData;
}

async function getDashboardAnalytics() {
    try {
        console.log("Fetching sales...");
        const sales = await _fetchAllParallel('daily_sales', 'date, quantity, barcode, fc_quantity, vf_quantity, stock', 'date');
        console.log("Sales fetched:", sales.length);

        console.log("Fetching products...");
        const products_all = await _fetchAllParallel('products', 'barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock, fc_stock, vf_stock', 'barcode');
        console.log("Products fetched:", products_all.length);
    } catch (e) {
        console.error("CAUGHT top:", e);
    }
}

getDashboardAnalytics().then(() => { process.exit(0); });
