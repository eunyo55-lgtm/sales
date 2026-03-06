const XLSX = require('xlsx');

// Create a mock workbook with dates
const wb = XLSX.utils.book_new();
const wsData = [
    ["바코드", new Date(2023, 0, 1), new Date(2023, 0, 2)],
    ["S123", "-", 5]
];
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

// Test default parsing
const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log("Default parsing:", jsonData[0]);

// Test with raw: false (returns formatted strings instead of serial numbers/Date objects)
const jsonDataRawFalse = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
console.log("raw: false parsing:", jsonDataRawFalse[0]);
