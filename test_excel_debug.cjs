const fs = require('fs');
const xlsx = require('xlsx');

function test() {
    const workbook = xlsx.readFile('c:/Users/onlin/Downloads/Coupang_Stocked_Data_List(2026-02-01~2026-02-26).xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet['!ref']);

    // Find barcode for '꾸꾸'
    let targetBarcode = '';
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        // Find column headers if we need to, but let's just search all cells in the row for '꾸꾸'
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[xlsx.utils.encode_cell({ c, r })];
            if (cell && String(cell.v).includes('꾸꾸')) {
                const cellI = sheet[xlsx.utils.encode_cell({ c: 8, r })]; // Barcode
                targetBarcode = cellI?.v;
                break;
            }
        }
        if (targetBarcode) break;
    }

    if (targetBarcode) {
        console.log('Found barcode:', targetBarcode);
        let count = 0;
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const cellA = sheet[xlsx.utils.encode_cell({ c: 0, r })]; // Date
            const cellI = sheet[xlsx.utils.encode_cell({ c: 8, r })]; // Barcode
            const cellM = sheet[xlsx.utils.encode_cell({ c: 12, r })]; // Sales
            const cellN = sheet[xlsx.utils.encode_cell({ c: 13, r })]; // Stock

            if (cellI && String(cellI.v) === String(targetBarcode)) {
                console.log(cellA?.w || cellA?.v, 'Sales:', cellM?.v, 'Stock:', cellN?.v);
                count++;
            }
        }
        console.log('Total rows matched:', count);
    } else {
        console.log('Could not find 꾸꾸');
    }
}
test();
