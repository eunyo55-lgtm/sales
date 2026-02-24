const https = require('https');
const options = {
    hostname: 'vzyfygmzqqiwgrcuydti.supabase.co',
    port: 443,
    path: '/rest/v1/products?select=barcode,current_stock,fc_stock,vf_stock,updated_at&order=updated_at.desc&limit=5',
    method: 'GET',
    headers: {
        'apikey': 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh',
        'Authorization': 'Bearer sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh'
    }
};
const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => { console.log(data); });
});
req.on('error', e => { console.error(e); });
req.end();
