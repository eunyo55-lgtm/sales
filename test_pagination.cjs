const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetchAll() {
    console.log("Starting fetch from 30 days ago...");

    const table = 'daily_sales';
    const select = 'date, quantity, barcode, stock';
    const order = 'date';

    // 30 days ago
    const thirtyDaysAgoObj = new Date();
    thirtyDaysAgoObj.setDate(thirtyDaysAgoObj.getDate() - 30);
    const startDate = thirtyDaysAgoObj.toISOString().split('T')[0];

    const BATCH_SIZE = 1000;
    const allData = [];
    let i = 0;

    console.time("fetch30Days");
    while (true) {
        let q = supabase.from(table).select(select).gte('date', startDate).range(i, i + BATCH_SIZE - 1).order(order);

        console.log(`Fetching range ${i} to ${i + BATCH_SIZE - 1}...`);
        console.time(`batch_${i}`);

        try {
            const { data, error } = await q;
            console.timeEnd(`batch_${i}`);

            if (error) {
                console.error(`Fetch error:`, error);
                break;
            }
            if (!data || data.length === 0) {
                console.log("No more data, breaking.");
                break;
            }
            allData.push(...data);

            if (data.length < BATCH_SIZE) {
                console.log("Reached end of data smaller than batch size.");
                break;
            }
            i += BATCH_SIZE;
        } catch (err) {
            console.error(`Network error:`, err);
            break;
        }
    }
    console.timeEnd("fetch30Days");
    console.log(`Total rows fetched: ${allData.length}`);
}

testFetchAll();
