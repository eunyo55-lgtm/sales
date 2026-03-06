const fs = require('fs');
const files = fs.readdirSync('c:/Users/onlin/Downloads').filter(f => f.includes('basic_operation_rocket_') && f.includes('202602'));
for (const file of files) {
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
            cName = cols.findIndex(c => c.includes('상품명') || c.includes('옵션명'));
            if (cDate !== -1) headerParsed = true;
            continue;
        }
        if (cols[cName] && cols[cName].includes('꾸꾸')) {
            console.log(file, cols[cDate].replace(/"/g, ''), cols[cSales].replace(/"/g, ''), cols[cStock].replace(/"/g, ''));
            break; // just print first one to check stock value
        }
    }
}
console.log('Done searching basic_operation_rocket_ files from Feb');
