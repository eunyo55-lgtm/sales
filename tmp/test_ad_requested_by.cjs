const crypto = require('crypto');

const accessKey = "f4c2a1d5-88a2-4f5a-b8aa-94b7291feee2";
const secretKey = "1b946f4a298463696a8767258d6712b3278b5353";
const customerId = "A00043165";

async function testWithRequestedBy() {
    const method = 'GET';
    const path = '/v2/providers/openapi/apis/api/v4/reports/summary';
    const params = { period: 'TODAY' };
    
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const queryString = new URLSearchParams(params).toString();
    const stringToSign = `${datetime}${method}${path}${queryString}`;

    const signature = crypto.createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('hex');

    const authHeader = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
    const url = `https://api-gateway.coupang.com${path}?${queryString}`;

    console.log(`Calling with X-Requested-By: ${url}`);
    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'X-Requested-By': customerId, // MANDATORY HEADER
                'X-Customer-Id': customerId,
                'User-Agent': 'Coupang-Open-API-SDK-JS/1.0',
            }
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response: ${text.substring(0, 500)}`);
    } catch (e) {
        console.error(`Fetch error:`, e.message);
    }
}

testWithRequestedBy();
