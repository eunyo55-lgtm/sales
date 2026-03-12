import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkExclusion() {
    const { data: products, error } = await supabase.from('products').select('name');
    if (error) {
        console.error(error);
        return;
    }

    const keywords = ["부자재", "사은품", "우일신", "일상화보", "매장", "수선 재발송"];
    const filtered = products.filter(p => keywords.some(kw => p.name.includes(kw)));

    console.log(`Total products in DB: ${products.length}`);
    console.log(`Products matching keywords: ${filtered.length}`);
    if (filtered.length > 0) {
        console.log("Samples:", filtered.slice(0, 5).map(p => p.name));
    }
}

checkExclusion();
