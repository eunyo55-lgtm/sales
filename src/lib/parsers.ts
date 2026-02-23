import * as XLSX from 'xlsx';

// --- Types ---

export interface ProductMaster {
    barcode: string;
    name: string;
    season: string;
    imageUrl?: string;
    // optionCode might be needed later, keeping it optional or removing if unused
    optionCode?: string;
    option?: string; // New: Option Value from Column D
    hqStock?: number;
}

export interface CoupangSalesRow {
    date: string; // YYYY-MM-DD
    barcode: string;
    salesQty: number;
    currentStock: number;
}

export interface IncomingStockRow {
    barcode: string;
    incomingQty: number;
}

// --- Parsers ---

/**
 * Parses EasyAdmin Product Master File
 * Mapping:
 * - C: Name
 * - D: Option (New)
 * - E: Season (default '정보없음')
 * - K: Barcode (Key)
 * - Q: Image URL
 * - U: HQ Stock (General Stock)
 */
export const parseProductMaster = async (file: File): Promise<ProductMaster[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Header 'A' means 0-indexed columns (A=0, B=1, ... K=10, Q=16, U=20)
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

                const safeParseInt = (val: any) => {
                    if (val === undefined || val === null) return 0;
                    const str = String(val).replace(/,/g, '').trim();
                    const num = Number(str);
                    return isNaN(num) ? 0 : Math.round(num);
                };

                const products: ProductMaster[] = jsonData.slice(1).map((row: any) => {
                    return {
                        barcode: row['K'] ? String(row['K']).replace(/\s+/g, '') : '',
                        name: row['C'] || 'Unknown Product',
                        option: row['D'] ? String(row['D']).trim() : '옵션없음', // Parse Column D
                        season: row['E'] ? String(row['E']).trim() : '정보없음',
                        imageUrl: row['Q'] || '',
                        hqStock: safeParseInt(row['U']),
                    };
                }).filter(p => p.barcode && p.name !== 'Unknown Product');

                resolve(products);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Parses Coupang Sales Data File
 * Mapping:
 * - A: Date (e.g. 20260101) -> Convert to YYYY-MM-DD
 * - I: Barcode
 * - M: Sales Qty (Sum needed)
 * - N: Current Stock (Use latest date's value)
 */
export const parseCoupangSales = async (file: File): Promise<CoupangSalesRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Force hardcoded columns as per user insistent request (A=Date, I=Barcode, M=Sales, N=Stock)
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

                if (jsonData.length === 0) {
                    reject(new Error("엑셀 파일이 비어있습니다."));
                    return;
                }

                // Helper for safe number parsing (removes commas, handles empty strings)
                const safeParseInt = (val: any) => {
                    if (val === undefined || val === null) return 0;
                    const str = String(val).replace(/,/g, '').trim();
                    if (str === '') return 0;
                    const num = Number(str);
                    return isNaN(num) ? 0 : Math.round(num); // Force integer to fix DB error
                };

                const salesRows: CoupangSalesRow[] = jsonData.slice(1).map((row: any) => {
                    // A: Date (e.g. 20260101)
                    let dateStr = row['A'] ? String(row['A']).trim() : '';
                    if (dateStr.length === 8) {
                        // YYYYMMDD -> YYYY-MM-DD
                        dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    }

                    // I: Barcode
                    const barcode = row['I'] ? String(row['I']).replace(/\s+/g, '') : '';

                    // M: Sales Qty
                    const salesQty = row['M'] ? Number(row['M']) : 0;

                    // N: Current Stock
                    const currentStock = row['N'] ? Number(row['N']) : 0;

                    return { date: dateStr, barcode, salesQty, currentStock };
                }).filter(r => r.barcode && r.date);

                resolve(salesRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Parses Incoming Stock File (Supply In Progress)
 * Mapping:
 * - F: SKU Barcode (Key)
 * - K: Confirmed Quantity (Value)
 */
export const parseIncomingStock = async (file: File): Promise<IncomingStockRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Header 'A' means 0-indexed
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });

                const incomingRows: IncomingStockRow[] = jsonData.slice(1).map((row: any) => {
                    return {
                        barcode: row['F'] ? String(row['F']).replace(/\s+/g, '') : '',
                        incomingQty: row['K'] ? Number(row['K']) : 0
                    };
                }).filter(r => r.barcode && r.incomingQty > 0);

                resolve(incomingRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
