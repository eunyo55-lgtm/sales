const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking coupang_orders table...');
    const { data, error, count } = await supabase
        .from('coupang_orders')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total rows: ${count}`);
    if (data && data.length > 0) {
        // Group by month to see distribution
        const distribution = data.reduce((acc, row) => {
            const month = row.order_date.substring(0, 7);
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});
        console.log('Data distribution by month:', distribution);
        
        console.log('\nSample rows (first 3):');
        console.log(data.slice(0, 3));
    } else {
        console.log('No data found in coupang_orders.');
    }
}

checkData();
