const fs = require('fs');
const xlsx = require('xlsx');

const p = 'c:/Users/onlin/Desktop/2월26일_오즈키즈_FC발주_2차.xlsm';
try {
    const wb = xlsx.readFile(p);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 'A' });

    console.log("FC발주 sample:");
    console.log(data.slice(0, 3));
} catch (e) {
    console.error(e.message);
}
