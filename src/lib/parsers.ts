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
    center: string; // 'FC' or 'VF164'
    centerRaw: string; // [NEW] Exact center string (e.g. '이천1센터')
}

export interface IncomingStockRow {
    barcode: string;
    incomingQty: number;
}

export interface HistoricalSalesRow {
    date: string; // YYYY-MM-DD
    barcode: string;
    salesQty: number;
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
 * - G: Center (FC or VF164)
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

                // Memory efficient parsing without sheet_to_json
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
                const salesRows: CoupangSalesRow[] = [];

                for (let r = range.s.r + 1; r <= range.e.r; r++) { // skip header at row 0
                    const cellA = sheet[XLSX.utils.encode_cell({ c: 0, r })]; // Date
                    const cellF = sheet[XLSX.utils.encode_cell({ c: 5, r })]; // Center
                    const cellI = sheet[XLSX.utils.encode_cell({ c: 8, r })]; // Barcode
                    const cellM = sheet[XLSX.utils.encode_cell({ c: 12, r })]; // Sales Qty
                    const cellN = sheet[XLSX.utils.encode_cell({ c: 13, r })]; // Stock

                    if (!cellA || !cellI) continue;

                    let dateStr = String(cellA.w || cellA.v).trim();
                    if (dateStr.length === 8 && !dateStr.includes('-')) {
                        dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    }

                    const centerRaw = String(cellF?.v || '').trim().toUpperCase();
                    let center = 'FC';
                    if (centerRaw === 'VF164' || centerRaw.includes('VF') || centerRaw.includes('VENDOR')) {
                        center = 'VF164';
                    }

                    const barcode = String(cellI.v || '').replace(/\s+/g, '');

                    let salesQty = 0;
                    if (cellM && cellM.v) {
                        const str = String(cellM.v).replace(/,/g, '').trim();
                        salesQty = isNaN(Number(str)) ? 0 : Math.round(Number(str));
                    }

                    let currentStock = 0;
                    if (cellN && cellN.v) {
                        const str = String(cellN.v).replace(/,/g, '').trim();
                        currentStock = isNaN(Number(str)) ? 0 : Math.round(Number(str));
                    }

                    if (barcode && dateStr) {
                        salesRows.push({ date: dateStr, barcode, salesQty, currentStock, center, centerRaw });
                    }
                }

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

/**
 * Parses Historical Sales Data (Wide Format)
 * Mapping:
 * - A (index 0): Barcode
 * - B (index 1)...: Dates (e.g. 1/1, 1/2) -> Converted to YYYY-MM-DD
 */
export const parseHistoricalSales = async (file: File, targetYear: number): Promise<HistoricalSalesRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
                if (jsonData.length < 2) return resolve([]);

                const headers = jsonData[0];
                const salesRows: HistoricalSalesRow[] = [];

                // Parse dates from headers
                const dateMap: Record<number, string> = {};
                for (let i = 1; i < headers.length; i++) {
                    const h = String(headers[i] || '').trim();
                    if (h) {
                        let month = '';
                        let day = '';
                        if (h.includes('/')) {
                            const parts = h.split('/');
                            month = parts[0].padStart(2, '0');
                            day = parts[1].padStart(2, '0');
                        } else if (h.includes('-')) {
                            const parts = h.split('-');
                            month = parts[0].padStart(2, '0');
                            day = parts[1].padStart(2, '0');
                        }

                        if (month && day && !isNaN(Number(month)) && !isNaN(Number(day))) {
                            dateMap[i] = `${targetYear}-${month}-${day}`;
                        }
                    }
                }

                for (let r = 1; r < jsonData.length; r++) {
                    const row = jsonData[r];
                    if (!row || row.length === 0) continue;

                    const barcode = String(row[0] || '').replace(/\s+/g, '');
                    if (!barcode) continue;

                    for (let i = 1; i < row.length; i++) {
                        const dateStr = dateMap[i];
                        if (!dateStr) continue;

                        const val = row[i];
                        const str = String(val).replace(/,/g, '').trim();
                        const num = Number(str);
                        const qty = isNaN(num) ? 0 : Math.round(num);

                        if (qty > 0) { // Only store non-zero sales
                            salesRows.push({
                                date: dateStr,
                                barcode,
                                salesQty: qty
                            });
                        }
                    }
                }

                resolve(salesRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
