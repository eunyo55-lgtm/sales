const customerId = "A00043165";

async function testEdgeAdNoJWT() {
    const url = "https://vzyfygmzqqiwgrcuydti.supabase.co/functions/v1/coupang-ad-proxy";
    const today = new Date().toISOString().split('T')[0];
    
    // Exact same params as what AdManagement will send
    const payload = {
        method: 'GET',
        path: '/v2/providers/openapi/apis/api/v4/ad-service/reports/summary',
        params: {
            customerId: customerId,
            startDate: today,
            endDate: today,
            reportType: 'SUMMARY'
        }
    };

    console.log(`Calling Edge Function (No JWT): ${url}`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-By': customerId
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Response:`, JSON.stringify(data));
    } catch (e) {
        console.error(`Fetch error:`, e.message);
    }
}

testEdgeAdNoJWT();
