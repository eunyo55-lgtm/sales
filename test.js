const salesData = [
    { barcode: 'A', center: 'FC', date: '2026-02-23', currentStock: 2 },
    { barcode: 'A', center: 'VF164', date: '2026-02-23', currentStock: 8 }
];

const latestDateMap = new Map();
salesData.forEach(row => {
    const current = latestDateMap.get(row.barcode) || { fcDate: '', vfDate: '' };
    if (row.center === 'FC') {
        if (row.date > current.fcDate) current.fcDate = row.date;
    } else if (row.center === 'VF164') {
        if (row.date > current.vfDate) current.vfDate = row.date;
    }
    latestDateMap.set(row.barcode, current);
});
console.log(latestDateMap.get('A'));

const stockMap = new Map();
salesData.forEach(row => {
    const latest = latestDateMap.get(row.barcode);
    const existing = stockMap.get(row.barcode) || { fcStock: 0, vfStock: 0, hasFC: false, hasVF: false };

    if (row.center === 'FC' && row.date === latest.fcDate) {
        existing.fcStock += row.currentStock;
        existing.hasFC = true;
    } else if (row.center === 'VF164' && row.date === latest.vfDate) {
        existing.vfStock += row.currentStock;
        existing.hasVF = true;
    }
    stockMap.set(row.barcode, existing);
});
console.log(stockMap.get('A'));
