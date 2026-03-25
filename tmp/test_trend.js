import { createClient } from '@supabase/supabase-js';

const supaUrl = process.env.VITE_SUPABASE_URL?.trim();
const supaKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supaUrl || !supaKey) {
  console.error("Missing env vars!");
  process.exit(1);
}

const supabase = createClient(supaUrl, supaKey);

async function testTrendData() {
    // Current dashboard sets trendStartDate 30 days back from anchorDate
    const anchorDate = '2026-03-23';
    
    // Simulate what the dashboard does
    const startObj = new Date(anchorDate);
    startObj.setDate(startObj.getDate() - 30);
    const startDate = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, '0')}-${String(startObj.getDate()).padStart(2, '0')}`;
    const endDate = anchorDate;
    
    console.log(`startDate: ${startDate}, endDate: ${endDate}`);

    const fetchRange = async (s, e) => {
        let allData = [];
        let i = 0;
        const BATCH = 5000;
        let isDone = false;
        while (!isDone) {
            const { data, error } = await supabase.from('daily_sales')
                .select('date, quantity')
                .gte('date', s)
                .lte('date', e)
                .range(i, i + BATCH - 1);
            if (error) throw error;
            if (data && data.length > 0) allData.push(...data);
            if (!data || data.length < BATCH) isDone = true;
            i += BATCH;
        }
        return allData;
    };

    const currentData = await fetchRange(startDate, endDate);
    
    const m0 = new Map();
    currentData.forEach(r => {
        const d = r.date.substring(0, 10);
        m0.set(d, (m0.get(d) || 0) + r.quantity);
    });

    const sParts = startDate.split('-').map(Number);
    const eParts = endDate.split('-').map(Number);
    const sDateInput = new Date(sParts[0], sParts[1] - 1, sParts[2]);
    const eDateInput = new Date(eParts[0], eParts[1] - 1, eParts[2]);

    const fetchYearOffsetMap = async (offset) => {
        const s = new Date(sDateInput); s.setFullYear(s.getFullYear() - offset);
        const e = new Date(eDateInput); e.setFullYear(e.getFullYear() - offset);
        
        const sStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
        const eStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
        
        console.log(`Offset ${offset} date range: ${sStr} to ${eStr}`);
        const data = await fetchRange(sStr, eStr);
        const m = new Map();
        data.forEach(r => {
            const mmdd = r.date.substring(5, 10);
            m.set(mmdd, (m.get(mmdd) || 0) + r.quantity);
        });
        return m;
    };

    const m1 = await fetchYearOffsetMap(1);
    const m2 = await fetchYearOffsetMap(2);

    const result = [];
    const curr = new Date(sDateInput);
    while (curr <= eDateInput) {
        const y = curr.getFullYear();
        const m = curr.getMonth() + 1;
        const d = curr.getDate();
        const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const mmdd = dStr.substring(5, 10);
        
        result.push({
            date: mmdd,
            fullDate: dStr,
            sales: m0.get(dStr) || 0,
            prevYearQuantity: m1.get(mmdd) || 0,
            prev2YearQuantity: m2.get(mmdd) || 0
        });
        curr.setDate(curr.getDate() + 1);
    }
    
    console.log("Trend Data snippet (last 5 items):");
    console.log(JSON.stringify(result.slice(-5), null, 2));
}

testTrendData().catch(console.error);
