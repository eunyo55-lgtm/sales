const fs = require('fs');
const xlsx = require('xlsx');

const p = 'c:/Users/onlin/Desktop/재고량.csv';
try {
    const wb = xlsx.readFile(p);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 'A' });

    console.log("재고량.csv sample:");
    console.log(data.slice(0, 3));
} catch (e) {
    console.error(e.message);
}
