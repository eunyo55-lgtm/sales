
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addIndexes() {
    const { data: r1, error: e1 } = await supabase.rpc('execute_sql_custom', { 
        sql_query: 'CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(date);' 
    });
    console.log('Index 1:', e1 || 'Success');

    const { data: r2, error: e2 } = await supabase.rpc('execute_sql_custom', { 
        sql_query: 'CREATE INDEX IF NOT EXISTS idx_daily_sales_barcode_date ON daily_sales(barcode, date);' 
    });
    console.log('Index 2:', e2 || 'Success');

    const { data: r3, error: e3 } = await supabase.rpc('execute_sql_custom', { 
        sql_query: 'CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword_id_date ON keyword_rankings(keyword_id, date);' 
    });
    console.log('Index 3:', e3 || 'Success');
}
addIndexes();

