import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function _fetchAllParallel(table, select, order) {
    const BATCH_SIZE = 1000;
    const allData = [];
    let i = 0;

    while (true) {
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
        i += BATCH_SIZE;
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
        return { sales, products_all };
    } catch (e) {
        console.error("CAUGHT top:", e);
        return null;
    }
}

getDashboardAnalytics().then((res) => { console.log(res ? "SUCCESS" : "NULL"); process.exit(0); });
