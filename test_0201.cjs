const fs = require('fs');
const files = fs.readdirSync('c:/Users/onlin/Downloads').filter(f => f.includes('basic_operation_rocket_') && f.includes('202602'));
for (const file of files) {
    if (!file.includes('2026020120260222')) continue;
    const path = 'c:/Users/onlin/Downloads/' + file;
    const content = fs.readFileSync(path, 'utf-8').split('\n');
    let cDate = -1, cBarcode = -1, cSales = -1, cStock = -1, cName = -1;
    let headerParsed = false;
    for (const line of content) {
        const cols = line.split(',');
        if (!headerParsed) {
            cDate = cols.findIndex(c => c.includes('일자') || c.includes('날짜'));
            cBarcode = cols.findIndex(c => c.includes('바코드'));
            cSales = cols.findIndex(c => c.includes('출고수량') || c.includes('매출'));
            cStock = cols.findIndex(c => c.includes('현재재고수량') || c.includes('재고'));
            cName = cols.findIndex(c => c.includes('SKU 명') || c.includes('상품명') || c.includes('옵션명'));
            if (cDate !== -1) headerParsed = true;
            continue;
        }
        if (cName !== -1 && cols[cName] && cols[cName].includes('꾸꾸')) {
            const dateStr = cols[cDate] ? cols[cDate].replace(/"/g, '') : '';
            if (dateStr === '20260201') {
                console.log(file, dateStr, 'Sales:', cols[cSales].replace(/"/g, ''), 'Stock:', cols[cStock].replace(/"/g, ''), 'Name:', cols[cName]);
            }
        }
    }
}
