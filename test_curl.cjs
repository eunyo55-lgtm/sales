const https = require('https');

const options = {
    hostname: 'vzyfygmzqqiwgrcuydti.supabase.co',
    port: 443,
    path: '/rest/v1/products?barcode=ilike.*001L12UOW140*&select=*',
    method: 'GET',
    headers: {
        'apikey': 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh',
        'Authorization': 'Bearer sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (d) => { data += d; });
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log("Count:", parsed.length);
        console.log(parsed);
    });
});

req.on('error', (e) => {
    console.error(e);
});
req.end();
