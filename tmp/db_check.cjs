const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vzyfygmzqqiwgrcuydti.supabase.co';
const supabaseKey = 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWeekly() {
    console.log('Fetching all coupang_orders...');
    let allData = [];
    let hasMore = true;
    let offset = 0;
    const limit = 1000;

    while (hasMore) {
        const { data, error } = await supabase
            .from('coupang_orders')
            .select('*')
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching data:', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData.push(...data);
            offset += limit;
            if (data.length < limit) hasMore = false;
        }
    }

    const groups = {};
    allData.forEach(o => {
        const d = new Date(o.order_date);
        const day = d.getDay();
        const diff = (day >= 5 ? day - 5 : day + 2);
        const fri = new Date(d);
        fri.setDate(d.getDate() - diff);
        const thu = new Date(fri);
        thu.setDate(fri.getDate() + 6);
        const key = `${fri.toISOString().split('T')[0]} ~ ${thu.toISOString().split('T')[0]}`;

        if (!groups[key]) {
            groups[key] = { count: 0, amount: 0 };
        }
        groups[key].count++;
        groups[key].amount += (o.order_qty * o.unit_cost);
    });

    console.log('Weekly distribution:');
    Object.keys(groups).sort().reverse().forEach(key => {
        console.log(`${key}: ${groups[key].count} rows, ${groups[key].amount.toLocaleString()} KRW`);
    });
}

checkWeekly();
