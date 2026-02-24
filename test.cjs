const fs = require('fs');
const xlsx = require('xlsx');

const p = 'c:/Users/onlin/Desktop/2월24일_오즈키즈_벤더플렉스발주.xlsx';
const wb = xlsx.readFile(p);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 'A' });

console.log(data.slice(0, 3));
