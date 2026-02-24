const fs = require('fs');
const xlsx = require('xlsx');

const p = 'C:/Users/onlin/Downloads/어드민상품매출통계_021203346.xls';
try {
    const wb = xlsx.readFile(p);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 'A' });

    console.log("Admin Sales sample:");
    console.log(data.slice(0, 3));
} catch (e) {
    console.error(e.message);
}
