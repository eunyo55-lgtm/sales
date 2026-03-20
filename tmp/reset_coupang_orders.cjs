
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function resetOrders() {
  console.log('--- Resetting coupang_orders table ---');
  
  // Attempt to delete all rows. Using a filter that matches everything.
  const { count, error } = await supabase
    .from('coupang_orders')
    .delete()
    .neq('barcode', 'NEVER_MATCH_THIS_STRING');

  if (error) {
    console.error('Error resetting orders:', error);
  } else {
    console.log('Successfully reset coupang_orders table.');
  }
}

resetOrders().catch(console.error);
