const XLSX = require('xlsx');
const sheet = XLSX.utils.aoa_to_sheet([
    ['날짜', '상품카테고리', '하위', '세부', '브랜드', '센터', 'SKU ID', 'SKU 명', '바코드', 'J', 'K', 'L', 'M출고', 'N재고'],
    ['20260223', 'a', 'b', 'c', 'd', '브랜드없음FC', '1', '2', 'O37A12GPK00F', '', '', '0', '0', '2'],
    ['20260223', 'a', 'b', 'c', 'd', '오즈키즈 VF164', '1', '2', 'O37A12GPK00F', '', '', '0', '0', '8'],
    ['20260223', 'a', 'b', 'c', 'd', 'VF164', '1', '2', 'O37A12GPK00F', '', '', '0', '0', '15']
]);
const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
const salesRows = jsonData.slice(1).map((row) => {
    let dateStr = row['A'] ? String(row['A']).trim() : '';
    if (dateStr.length === 8) dateStr = dateStr.substring(0, 4) + '-' + dateStr.substring(4, 6) + '-' + dateStr.substring(6, 8);

    // THE BUG MIGHT BE HERE
    const centerRaw = row['F'] ? String(row['F']).trim().toUpperCase() : '';
    let center = 'FC';
    if (centerRaw === 'VF164' || centerRaw.includes('VF') || centerRaw.includes('VENDOR')) center = 'VF164';

    const barcode = row['I'] ? String(row['I']).replace(/\s+/g, '') : '';
    const salesQty = row['M'] ? Number(row['M']) : 0;
    const currentStock = row['N'] ? Number(row['N']) : 0;
    return { date: dateStr, barcode, center, currentStock, centerRaw, rawF: row['F'] };
});
console.dir(salesRows);
