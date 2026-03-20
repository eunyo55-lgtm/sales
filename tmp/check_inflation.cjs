
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract env from .env.local manually to avoid dotenv dependency issues if not installed
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function analyzeOrders() {
  console.log('--- Analyzing coupang_orders table ---');

  // 1. Get total row count
  const { count, error: countError } = await supabase
    .from('coupang_orders')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total Row Count:', count);

  // 2. Sample data to check center values
  const { data: sample, error: sampleError } = await supabase
    .from('coupang_orders')
    .select('order_date, barcode, center, order_qty')
    .limit(5);
  
  console.log('Sample data (keys and centers):', sample);

  // 3. Check for specific date (1/2 is a known error date)
  const { data: jan2, error: jan2Error } = await supabase
    .from('coupang_orders')
    .select('order_qty.sum(), count:order_date.count()')
    .eq('order_date', '2026-01-02');
  
  console.log('2026-01-02 Analysis:', jan2);

  // 4. Check for duplicates (same date and barcode)
  // Since we have 'center' now, let's see if we have multiple rows for (date, barcode)
  // but different centers (which is intended) or multiple rows for (date, barcode, center)
  // Actually, we'll fetch a small batch and look for duplicates manually.
  const { data: items } = await supabase
    .from('coupang_orders')
    .select('order_date, barcode, center, order_qty')
    .eq('order_date', '2026-01-02')
    .limit(100);
    
  if (items) {
    const keys = items.map(i => `${i.order_date}_${i.barcode}_${i.center}`);
    const uniqueKeys = new Set(keys);
    console.log(`Unique Keys in first 100 rows of Jan 2: ${uniqueKeys.size} / 100`);
    if (uniqueKeys.size < 100) {
        console.log('DUPLICATE KEYS DETECTED IN coupang_orders!');
    }
  }
}

analyzeOrders().catch(console.error);
