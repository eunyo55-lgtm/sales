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
    cost?: number; // New: Cost from Column M
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

export interface CoupangOrderRow {
    date: string;       // H: 입고예정일
    barcode: string;    // F: 바코드
    orderQty: number;   // J: 발주수량
    confirmedQty: number; // K: 확정수량
    receivedQty: number;  // L: 입고수량
    unitCost: number;     // R: 쿠팡매입가
    center: string;       // [NEW] Center info (FC or VF164)
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

                const sanitizeString = (val: any) => {
                    if (!val) return '';
                    // Remove HTML tags and common Excel/MSO artifacts
                    return String(val)
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/mso-number-format:[^;]+;/g, '') // Remove Excel mso tags
                        .replace(/white-space:[^;]+;/g, '') // Remove CSS white-space tags
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                };

                const products: ProductMaster[] = jsonData.slice(1).map((row: any) => {
                    return {
                        barcode: row['K'] ? String(row['K']).replace(/\s+/g, '') : '',
                        name: sanitizeString(row['C']) || 'Unknown Product',
                        option: row['D'] ? sanitizeString(row['D']) : '옵션없음', // Parse Column D
                        season: row['E'] ? sanitizeString(row['E']) : '정보없음',
                        imageUrl: row['Q'] || '',
                        hqStock: safeParseInt(row['U']),
                        cost: safeParseInt(row['M']), // New: Cost from Column M (0-indexed 12)
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
export const parseCoupangSales = async (file: File, targetYearOverride?: number): Promise<CoupangSalesRow[]> => {
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

                // Find the header row (search first 10 rows)
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                    const row = jsonData[i] || [];
                    if (row.some((cell: any) => {
                        const s = String(cell || '');
                        return s.includes('날짜') || s.includes('Date') || s.includes('바코드') || s.includes('Barcode');
                    })) {
                        headerRowIndex = i;
                        break;
                    }
                }

                const headers = (jsonData[headerRowIndex] || []).map((h: any) => String(h || '').trim());
                
                // Dynamic Column Detection
                const findCol = (keywords: string[]) => headers.findIndex((h: string) => keywords.some(k => h.includes(k)));
                
                const colDate = findCol(['날짜', 'Date']);
                const colCenter = findCol(['센터', '물류센터', 'Center']);
                const colBarcode = findCol(['바코드', 'Barcode', '등록바코드']);
                const colSkuId = findCol(['단품번호', 'SKU ID', '단품ID']);
                const colSales = findCol(['판매수량', '출고수량', 'Sales']);
                const colStock = findCol(['재고수량', '현재재고', 'Stock']);

                // Fallback: If some columns not found by name, use hardcoded defaults from common report
                const idxDate = colDate !== -1 ? colDate : 0;
                const idxCenter = colCenter !== -1 ? colCenter : 5;
                const idxBarcode = colBarcode !== -1 ? colBarcode : 8;
                const idxSkuId = colSkuId !== -1 ? colSkuId : 6;
                const idxSales = colSales !== -1 ? colSales : 12;
                const idxStock = colStock !== -1 ? colStock : 13;

                const salesRows: CoupangSalesRow[] = [];

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const cellA = row[idxDate];
                    const cellF = row[idxCenter];
                    const cellI = row[idxBarcode];
                    const cellG = row[idxSkuId]; // Fallback for barcode
                    const cellM = row[idxSales];
                    const cellN = row[idxStock];

                    if (!cellA) continue;

                    let dateStr = '';
                    if (typeof cellA === 'number') {
                        const p = XLSX.SSF.parse_date_code(cellA);
                        if (p) {
                            const y = targetYearOverride || p.y;
                            dateStr = `${y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
                        }
                    } else {
                        const rawVal = String(cellA).trim();
                        if (rawVal.length === 8 && !rawVal.includes('-')) {
                            const y = targetYearOverride || rawVal.substring(0, 4);
                            dateStr = `${y}-${rawVal.substring(4, 6)}-${rawVal.substring(6, 8)}`; // Fixed Bug
                        } else if (targetYearOverride) {
                            if (rawVal.includes('-')) {
                                const parts = rawVal.split('-');
                                if (parts.length === 2) {
                                    dateStr = `${targetYearOverride}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                                } else if (parts.length === 3) {
                                    dateStr = `${targetYearOverride}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                }
                            } else if (rawVal.includes('/')) {
                                const parts = rawVal.split('/');
                                if (parts.length === 2) {
                                    dateStr = `${targetYearOverride}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                                } else if (parts.length === 3) {
                                    dateStr = `${targetYearOverride}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                }
                            } else {
                                dateStr = rawVal;
                            }
                        } else {
                            dateStr = rawVal;
                            if (dateStr.length === 8 && !dateStr.includes('-')) {
                                dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                            }
                        }
                    }

                    const centerRaw = String(cellF || '').trim().toUpperCase();
                    let center = 'FC';
                    if (centerRaw === 'VF164' || centerRaw.includes('VF') || centerRaw.includes('VENDOR')) {
                        center = 'VF164';
                    }

                    // Fallback: use SKU ID if Barcode is empty
                    let barcode = String(cellI || '').replace(/\s+/g, '');
                    if (!barcode && cellG) {
                        barcode = String(cellG).replace(/\s+/g, '');
                    }

                    let salesQty = 0;
                    if (cellM !== undefined && cellM !== null) {
                        const str = String(cellM).replace(/,/g, '').trim();
                        salesQty = isNaN(Number(str)) ? 0 : Math.round(Number(str));
                    }

                    let currentStock = 0;
                    if (cellN !== undefined && cellN !== null) {
                        const str = String(cellN).replace(/,/g, '').trim();
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
                    const val = headers[i];
                    let month = '';
                    let day = '';

                    if (typeof val === 'number') {
                        // Excel date serial number
                        const parsedDate = XLSX.SSF.parse_date_code(val);
                        if (parsedDate) {
                            month = String(parsedDate.m).padStart(2, '0');
                            day = String(parsedDate.d).padStart(2, '0');
                        }
                    } else {
                        const h = String(val || '').trim();
                        if (h.includes('/')) {
                            const parts = h.split('/');
                            month = parts[0].padStart(2, '0');
                            day = parts[1].padStart(2, '0');
                        } else if (h.includes('-')) {
                            const parts = h.split('-');
                            month = parts[0].padStart(2, '0');
                            day = parts[1].padStart(2, '0');
                        } else if (h.includes('월')) {
                            const parts = h.split('월');
                            if (parts.length >= 2) {
                                month = parts[0].replace(/[^0-9]/g, '').padStart(2, '0');
                                day = parts[1].replace(/[^0-9]/g, '').padStart(2, '0');
                            }
                        }
                    }

                    if (month && day && !isNaN(Number(month)) && !isNaN(Number(day))) {
                        dateMap[i] = `${targetYear}-${month}-${day}`;
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

/**
 * Parses Coupang Order/Supply File
 */
export const parseCoupangOrder = async (file: File): Promise<CoupangOrderRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
                const parseDate = (val: any) => {
                    if (!val) return '';
                    let dStr = '';
                    if (typeof val === 'number') {
                        const p = XLSX.SSF.parse_date_code(val);
                        dStr = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
                    } else {
                        dStr = String(val).trim().replace(/\./g, '-');
                    }
                    if (dStr.length < 8) return '';
                    const d = new Date(dStr);
                    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
                };
                const safe = (v: any) => isNaN(Number(String(v).replace(/,/g, ''))) ? 0 : Math.round(Number(String(v).replace(/,/g, '')));

                // Try to find center from keywords in some columns (A: 발주번호, B: 센터명)
                const detectCenter = (row: any) => {
                    const cName = String(row['B'] || '').toUpperCase();
                    if (cName.includes('VF') || cName.includes('VENDOR')) return 'VF164';
                    return 'FC';
                };

                const orders: CoupangOrderRow[] = (jsonData as any[]).slice(1).map((r: any) => ({
                    barcode: r['F'] ? String(r['F']).replace(/\s+/g, '') : '',
                    date: parseDate(r['H']),
                    orderQty: safe(r['J']),
                    confirmedQty: safe(r['K']),
                    receivedQty: safe(r['L']),
                    unitCost: safe(r['R']),
                    center: detectCenter(r)
                })).filter(o => o.barcode && o.date);
                resolve(orders);
            } catch (err) { reject(err); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};
