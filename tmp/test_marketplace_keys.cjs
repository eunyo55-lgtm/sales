const crypto = require('crypto');

const accessKey = "f4c2a1d5-88a2-4f5a-b8aa-94b7291feee2";
const secretKey = "1b946f4a298463696a8767258d6712b3278b5353";
const vendorId = "A00043165";

async function testMarketplaceAPI() {
    const method = 'GET';
    const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    const params = { vendorId: vendorId, maxPerPage: 1 };
    
    const now = new Date();
    const datetime = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const queryString = new URLSearchParams(params).toString();
    const stringToSign = `${datetime}${method}${path}${queryString}`;

    const signature = crypto.createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('hex');

    const authHeader = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
    const url = `https://api-gateway.coupang.com${path}?${queryString}`;

    console.log(`Calling Marketplace API: ${url}`);
    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'X-Requested-By': vendorId
            }
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response: ${text.substring(0, 500)}`);
    } catch (e) {
        console.error(`Fetch error:`, e.message);
    }
}

testMarketplaceAPI();
