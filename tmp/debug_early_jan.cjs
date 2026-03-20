const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEarlyJanData() {
    console.log("Checking data for 2026-01-01 ~ 2026-01-08...");
    
    let allData = [];
    let from = 0;
    const step = 1000;
    let done = false;

    while (!done) {
        const { data, error } = await supabase
            .from('coupang_orders')
            .select('*')
            .gte('order_date', '2026-01-01')
            .lte('order_date', '2026-01-08')
            .range(from, from + step - 1);

        if (error) {
            console.error("Error fetching data:", error);
            return;
        }

        allData.push(...data);
        if (data.length < step) done = true;
        else from += step;
    }

    const data = allData;

    console.log(`Total rows found: ${data.length}`);

    // Check for duplicates (same date, barcode, center)
    const counts = {};
    const outliers = [];
    let totalQty = 0;
    let totalAmount = 0;

    data.forEach(row => {
        const key = `${row.order_date}|${row.barcode}|${row.center}`;
        counts[key] = (counts[key] || 0) + 1;
        
        totalQty += row.order_qty;
        totalAmount += row.order_qty * row.unit_cost;

        if (row.order_qty > 500) {
            outliers.push(row);
        }
    });

    // Check for multiple created_at or centers for same (date, barcode)
    const dateBarcodeStats = {};
    const createdAtStats = {};

    data.forEach(row => {
        const key = `${row.order_date}|${row.barcode}`;
        if (!dateBarcodeStats[key]) dateBarcodeStats[key] = [];
        dateBarcodeStats[key].push(row);

        const ts = row.created_at.split('T')[0];
        createdAtStats[ts] = (createdAtStats[ts] || 0) + 1;
    });

    const multiEntries = Object.entries(dateBarcodeStats).filter(([key, rows]) => rows.length > 1);
    console.log(`(Date, Barcode) combinations with multiple entries: ${multiEntries.length}`);
    if (multiEntries.length > 0) {
        console.log("Sample multi-entry (same date/barcode):");
        const first = multiEntries[0][1];
        console.log(first);
    }

    // Aggregate by week
    const weeklyStats = {};
    data.forEach(row => {
        const d = new Date(row.order_date);
        const day = d.getDay();
        const diff = (day >= 5 ? day - 5 : day + 2);
        const fri = new Date(d);
        fri.setDate(d.getDate() - diff);
        const key = fri.toISOString().split('T')[0];
        
        if (!weeklyStats[key]) weeklyStats[key] = { qty: 0, amt: 0, rows: 0 };
        weeklyStats[key].qty += row.order_qty;
        weeklyStats[key].amt += row.order_qty * row.unit_cost;
        weeklyStats[key].rows += 1;
    });

    console.log("Weekly aggregated stats (within Jan 1-8 range):");
    console.log(weeklyStats);

    // Let's also peek at late Jan for comparison
    console.log("\nFetching sample from late Jan for comparison...");
    const { data: lateJan } = await supabase
        .from('coupang_orders')
        .select('*')
        .gte('order_date', '2026-01-20')
        .lte('order_date', '2026-01-27')
        .limit(100);
    
    // Check total count for late Jan
    const { count: lateJanCount, error: countErr } = await supabase
        .from('coupang_orders')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', '2026-01-20')
        .lte('order_date', '2026-01-27');
    
    console.log(`Late Jan (20-27) total rows: ${lateJanCount}`);
}

checkEarlyJanData();
