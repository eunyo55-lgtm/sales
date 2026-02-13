import * as XLSX from 'xlsx';

// --- Types ---

export interface ProductMaster {
    barcode: string;
    name: string;
    season: string;
    imageUrl?: string;
    // optionCode might be needed later, keeping it optional or removing if unused
    optionCode?: string;
    hqStock?: number;
}

export interface CoupangSalesRow {
    date: string; // YYYY-MM-DD
    barcode: string;
    salesQty: number;
    currentStock: number;
}

// --- Parsers ---

/**
 * Parses EasyAdmin Product Master File
 * Mapping:
 * - C: Name
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

                const rawRows = jsonData.slice(1).map((row: any) => {
                    let rawDate = row['A'];
                    let formattedDate = '';

                    // Date Parsing Logic (Strict YYYYMMDD or YYYY-MM-DD)
                    // Removed Excel Serial Date support as it conflicts with 5-digit numbers (e.g., prices like 46220 -> July 2026)
                    const strDate = String(rawDate).replace(/[^0-9/-]/g, '').trim();

                    // 1. YYYYMMDD (8 digits)
                    if (/^\d{8}$/.test(strDate)) {
                        const year = parseInt(strDate.substring(0, 4));
                        // Sanity check year to avoid garbage
                        if (year >= 2020 && year <= 2030) {
                            formattedDate = `${strDate.substring(0, 4)}-${strDate.substring(4, 6)}-${strDate.substring(6, 8)}`;
                        }
                    }
                    // 2. YYYY-MM-DD or YYYY/MM/DD
                    else if (strDate.includes('-') || strDate.includes('/')) {
                        const tryDate = new Date(strDate);
                        if (!isNaN(tryDate.getTime()) && tryDate.getFullYear() >= 2020) {
                            formattedDate = tryDate.toISOString().split('T')[0];
                        }
                    }

                    return {
                        date: formattedDate, // Can be empty string if failed
                        barcode: row['I'] ? String(row['I']).replace(/\s+/g, '') : '',
                        salesQty: safeParseInt(row['M']),
                        currentStock: safeParseInt(row['N']),
                    };
                }).filter(r => r.barcode && r.date);

                resolve(rawRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
