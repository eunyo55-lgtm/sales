const XLSX = require('xlsx');

function safeParseInt(val) {
    if (val === undefined || val === null) return 0;
    const str = String(val).replace(/,/g, '').trim();
    const num = Number(str);
    return isNaN(num) ? 0 : Math.round(num);
}

const sheet = XLSX.utils.aoa_to_sheet([
    ['날짜', '상품카테고리', '하위', '세부', '브랜드', '센터', 'SKU ID', 'SKU 명', '바코드', 'J', 'K', 'L', 'M출고', 'N재고'],
    ['2026-02-23', 'a', 'b', 'c', 'd', 'FC', '1', '2', 'ABC1', '', '', '0', '1', '10'],
    ['2026-02-23', 'a', 'b', 'c', 'd', 'VF164', '1', '2', 'ABC1', '', '', '0', '2', '5'],
]);

const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
if (jsonData.length === 0) {
    console.log("Empty");
    process.exit(1);
}

const salesRows = jsonData.slice(1).map((row) => {
    let dateStr = row['A'] ? String(row['A']).trim() : '';
    if (dateStr.length === 8 && !dateStr.includes('-')) {
        dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    const centerRaw = row['F'] ? String(row['F']).trim().toUpperCase() : '';
    let center = 'FC';
    if (centerRaw === 'VF164' || centerRaw.includes('VF') || centerRaw.includes('VENDOR')) {
        center = 'VF164';
    }
    const barcode = row['I'] ? String(row['I']).replace(/\s+/g, '') : '';
    const salesQty = safeParseInt(row['M']);
    const currentStock = safeParseInt(row['N']);

    return { date: dateStr, barcode, salesQty, currentStock, center, centerRaw };
}).filter(r => r.barcode && r.date);

console.log("Parsed Rows:", salesRows.length);

const aggregatedSalesMap = new Map();
salesRows.forEach(row => {
    const key = `${row.date}_${row.barcode}`;
    const existing = aggregatedSalesMap.get(key);
    const isFC = row.center === 'FC';
    const isVF = row.center === 'VF164';

    if (existing) {
        existing.salesQty += row.salesQty;
        if (isFC) existing.fcQty += row.salesQty;
        if (isVF) existing.vfQty += row.salesQty;
        if (row.currentStock > 0) existing.currentStock = Math.max(existing.currentStock, row.currentStock);
    } else {
        aggregatedSalesMap.set(key, { ...row, fcQty: isFC ? row.salesQty : 0, vfQty: isVF ? row.salesQty : 0 });
    }
});

const uniqueSales = Array.from(aggregatedSalesMap.values());
console.log("Unique Sales:", uniqueSales.length);

const uniqueBarcodes = Array.from(new Set(uniqueSales.map(s => s.barcode)));
console.log("Unique Barcodes:", uniqueBarcodes.length);
