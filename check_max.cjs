const https = require('https');
const options = {
    hostname: 'vzyfygmzqqiwgrcuydti.supabase.co',
    port: 443,
    path: '/rest/v1/daily_sales?select=date,quantity,fc_quantity,vf_quantity&order=date.desc&limit=10',
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
