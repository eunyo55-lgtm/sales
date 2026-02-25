const fs = require('fs');
const xlsx = require('xlsx');

const files = fs.readdirSync('c:/Users/onlin/Desktop').filter(f => f.includes('판매'));

if (files.length > 0) {
    console.log("Reading file:", files[0]);
    const wb = xlsx.readFile('c:/Users/onlin/Desktop/' + files[0]);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 'A' });

    let sum = 0;
    const target = data.filter(row => {
        const k = row['K'] ? String(row['K']).trim() : '';
        const c = row['C'] ? String(row['C']).trim() : '';
        return k === 'O01L12UOW140' || k === '001L12UOW140' || (c.includes('꾸꾸') && c.includes('화이트') && c.includes('140'));
    });

    console.log("Matching Rows found:", target.length);
    target.forEach(r => {
        console.log(`Date: ${r['A']}, Center: ${r['G']}(raw: ${r['F']}), Barcode: ${r['K']}, Stock: ${r['N']}`);
    });
} else {
    console.log('No file');
}
