import { supabase } from './supabase';
import type { ProductMaster, CoupangSalesRow, IncomingStockRow } from './parsers';

export interface ProductStats {
    barcode: string;
    name: string;
    option?: string; // New: Option Value
    season: string;
    imageUrl?: string;
    hqStock: number;       // From Product Master (Col U)
    coupangStock: number;  // From Sales File (Col N, latest)
    incomingStock: number; // [NEW] From Supply In Progress File
    safetyStock: number;   // From Product Master
    totalSales: number;
    sales14Days: number;   // Last 14 days
    sales7Days: number;    // Last 7 days
    salesYesterday: number;// Latest date sales
    avgDailySales: number; // Last 7 days avg
    daysOfInventory: number;
    dailySales: Record<string, number>; // Date (YYYY-MM-DD) -> Quantity
    abcGrade: 'A' | 'B' | 'C' | 'D'; // ABC Analysis Grade (Based on 7-day sales)
    prevSales7Days: number; // Sales 8-14 days ago
    trend: 'hot' | 'cold' | 'up' | 'down' | 'flat';
    sales30Days: number;
    trends: {
        yesterday: number;
        week: number;
        month: number;
    };
}

export const api = {
    // Cache Storage
    _dashboardCache: null as any,
    _productStatsCache: null as ProductStats[] | null,

    /**
     * Clear Cache (Call on data updates)
     */
    clearCache() {
        this._dashboardCache = null;
        this._productStatsCache = null;
    },

    /**
     * Upload Product Master Data to Supabase
     */
    async uploadProducts(products: ProductMaster[], onProgress?: (progress: number) => void) {
        this.clearCache(); // Invalidate cache
        if (products.length === 0) return;

        // DEBUG: Check first item
        const sample = products[0];
        alert(`[데이터 확인]\n첫 번째 상품 파싱 결과:\n이름: ${sample.name}\n옵션(D열): ${sample.option}\n바코드: ${sample.barcode}\n\n옵션이 '옵션없음'으로 보이면 D열이 비어있거나 다른 열일 수 있습니다.`);

        // ... (rest of function)
        // Deduplicate by barcode (last one wins)
        const uniqueProductsMap = new Map<string, ProductMaster>();
        products.forEach(p => {
            if (p.barcode) uniqueProductsMap.set(p.barcode, p);
        });
        const uniqueProducts = Array.from(uniqueProductsMap.values());

        const CHUNK_SIZE = 500;
        const total = uniqueProducts.length;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = uniqueProducts.slice(i, i + CHUNK_SIZE);

            const { error } = await supabase
                .from('products')
                .upsert(
                    chunk.map(p => ({
                        barcode: p.barcode,
                        name: p.name,
                        option_value: p.option || '옵션없음', // Save to DB
                        season: p.season,
                        image_url: p.imageUrl,
                        hq_stock: p.hqStock || 0, // Prepare to save this to DB
                        updated_at: new Date().toISOString(),
                    })),
                    { onConflict: 'barcode' }
                );

            if (error) throw error;

            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }
    },

    /**
     * Upload Sales Data to Supabase
     */
    async uploadSales(salesData: CoupangSalesRow[], onProgress?: (progress: number) => void) {
        this.clearCache(); // Invalidate cache
        if (salesData.length === 0) return;

        // ... (rest of implementation remains same until next function)
        // Deduplicate sales data
        const aggregatedSalesMap = new Map<string, CoupangSalesRow>();
        salesData.forEach(row => {
            const key = `${row.date}_${row.barcode}`;
            const existing = aggregatedSalesMap.get(key);
            if (existing) {
                existing.salesQty += row.salesQty;
                // [FIX] Duplicate line removed.
                // [FIX] Do NOT sum stock. Use Max or Latest > 0.
                if (row.currentStock > 0) {
                    existing.currentStock = Math.max(existing.currentStock, row.currentStock);
                } else {
                    // Keep existing non-zero
                }
            } else {
                aggregatedSalesMap.set(key, { ...row });
            }
        });

        const uniqueSales = Array.from(aggregatedSalesMap.values());

        // 0. Ensure all products exist in 'products' table to avoid FK error
        const uniqueBarcodes = Array.from(new Set(uniqueSales.map(s => s.barcode)));

        const PROD_CHUNK_SIZE = 500;
        for (let i = 0; i < uniqueBarcodes.length; i += PROD_CHUNK_SIZE) {
            const barcodeChunk = uniqueBarcodes.slice(i, i + PROD_CHUNK_SIZE);
            const { error: prodError } = await supabase
                .from('products')
                .upsert(
                    barcodeChunk.map(bc => ({
                        barcode: bc,
                        name: '미등록 상품',
                        option_value: '옵션없음',
                        season: '정보없음',
                        updated_at: new Date().toISOString()
                    })),
                    { onConflict: 'barcode', ignoreDuplicates: true }
                );

            if (prodError) throw prodError;
        }

        const CHUNK_SIZE = 1000;
        const total = uniqueSales.length;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = uniqueSales.slice(i, i + CHUNK_SIZE);

            const { error } = await supabase
                .from('daily_sales')
                .upsert(
                    chunk.map(s => ({
                        date: s.date,
                        barcode: s.barcode,
                        quantity: s.salesQty,
                    })),
                    { onConflict: 'date, barcode' }
                );

            if (error) throw error;

            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }

        // Update Product Stock Logic (Coupang Stock)
        // Revised Strategy: Find the LATEST DATE in the uploaded file.
        // Only use stock data from that date (Global Max Date).

        // Revised Strategy: Find the LATEST DATE PER BARCODE.
        // Stock is recorded per row (date). Use the latest available stock for each product.
        const stockMap = new Map<string, { date: string, stock: number }>();

        uniqueSales.forEach(row => {
            const existing = stockMap.get(row.barcode);

            // Logic:
            // 1. If no entry, set (even if 0, but preferably > 0 if available later)
            // 2. If new date > existing date, take new date's stock (even if 0? better check >0)
            // 3. If same date, take Max (to avoid 0 overriding valid number)

            if (!existing) {
                stockMap.set(row.barcode, { date: row.date, stock: row.currentStock });
            } else {
                if (row.date > existing.date) {
                    // New date. Overwrite ONLY if new stock > 0.
                    // If new stock is 0, we suspect it's a missing data point in the transaction log,
                    // so we keep the old valid stock.
                    if (row.currentStock > 0) {
                        stockMap.set(row.barcode, { date: row.date, stock: row.currentStock });
                    }
                } else if (row.date === existing.date) {
                    // Same date. Take Max.
                    const newStock = Math.max(existing.stock, row.currentStock);
                    stockMap.set(row.barcode, { date: row.date, stock: newStock });
                }
            }
        });

        const stockUpdates = Array.from(stockMap.entries()).map(([barcode, data]) => ({
            barcode,
            current_stock: data.stock,
            updated_at: new Date().toISOString()
        }));

        // Sample Check for Debugging
        let sampleText = "데이터 없음";
        let nonZeroCount = 0;

        if (stockUpdates.length > 0) {
            const firstItems = stockUpdates.slice(0, 5);
            sampleText = firstItems.map(s => `[${s.barcode}] 재고: ${s.current_stock}`).join('\n');
            nonZeroCount = stockUpdates.filter(s => s.current_stock > 0).length;
        }

        // DEBUG ALERT to confirm logic
        if (typeof window !== 'undefined') {
            const msg = `[데이터 분석 결과]
- 로드된 행: ${uniqueSales.length}개
- 재고 업데이트 대상: ${stockUpdates.length}개 품목 (각 상품별 최신 날짜 기준)
- 유효 재고(>0) 발견: ${nonZeroCount}개 품목

[샘플 데이터 (N열 확인)]
${sampleText}

* 중요: 유효 재고가 0개라면, 엑셀의 N열(현재고)이 비어있거나 0인 상태입니다.
* 확인을 누르면 저장을 시작합니다.`;
            alert(msg);
        }

        if (stockUpdates.length > 0) {
            let errorCount = 0;
            let successCount = 0;
            let lastError = '';

            // Reduced chunk size for parallel updates to avoid rate limits/timeouts
            // Since we cannot use upsert (missing constraints/ID), we iterate updates.
            const BATCH_SIZE = 50;

            for (let j = 0; j < stockUpdates.length; j += BATCH_SIZE) {
                const chunk = stockUpdates.slice(j, j + BATCH_SIZE);

                // Process chunk in parallel (update by barcode)
                const promises = chunk.map(item =>
                    supabase
                        .from('products')
                        .update({
                            current_stock: item.current_stock,
                            updated_at: item.updated_at
                        })
                        .eq('barcode', item.barcode)
                );

                const results = await Promise.all(promises);

                // Check results
                results.forEach((res) => {
                    if (res.error) {
                        console.error("Update error:", res.error);
                        errorCount++;
                        lastError = res.error.message;
                    } else {
                        successCount++;
                    }
                });
            }

            if (typeof window !== 'undefined') {
                if (errorCount > 0) {
                    alert(`⚠️ 저장 중 일부 오류 발생 (${errorCount}건 실패)\n마지막 오류: ${lastError}`);
                } else {
                    alert(`✅ 성공! ${stockUpdates.length}개 품목의 재고 업데이트 요청을 완료했습니다.\n\n화면을 새로고침하여 확인해주세요.`);
                }
            }
        }
    },

    /**
     * Upload Incoming Stock Data (Supply In Progress)
     */
    async uploadIncomingStock(incomingData: IncomingStockRow[], onProgress?: (progress: number) => void) {
        this.clearCache();
        if (incomingData.length === 0) return;

        // Deduplicate: Sum incoming qty for same barcode
        const stockMap = new Map<string, number>();
        incomingData.forEach(row => {
            stockMap.set(row.barcode, (stockMap.get(row.barcode) || 0) + row.incomingQty);
        });

        const updates = Array.from(stockMap.entries()).map(([barcode, qty]) => ({
            barcode,
            incoming_stock: qty,
            updated_at: new Date().toISOString()
        }));

        const CHUNK_SIZE = 100;
        const total = updates.length;
        let processed = 0;

        // Reset all incoming stocks to 0 first? 
        // Ideally yes, because this file replaces the current state of "what is coming".
        // But doing a full table update might be heavy. 
        // For now, let's assume we overwrite existing ones. 
        // User didn't ask to clear old ones, but usually "Incoming Stock" is a snapshot.
        // Let's reset first for safety or just upsert. 
        // If we upsert, old incoming stock might remain if not in new file.
        // Let's try to set all incoming_stock to 0 for all products first?
        // That might be too slow. Let's just update for now. 
        // Actually, to be accurate, we should probably zero out columns before update, 
        // but let's stick to updating what we have. 

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);

            // We can't use bulk upsert easily for just one column without affecting others if we want to be safe,
            // but `upsert` in Supabase works as "insert or update".
            // Since we want to update ONLY incoming_stock, we should use `update` with `eq`.
            // But doing it one by one is slow.
            // `upsert` requires all non-default required columns if inserting.
            // Products already exist.

            // Parallel updates
            const promises = chunk.map(item =>
                supabase
                    .from('products')
                    .update({
                        incoming_stock: item.incoming_stock,
                        updated_at: item.updated_at
                    })
                    .eq('barcode', item.barcode)
            );

            await Promise.all(promises);

            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }
    },

    /**
     * Fetch Comprehensive Dashboard Analytics
     * - Key Metrics: Yesterday, Weekly (Fri-Thu), Monthly, Yearly
     * - Trends: Daily (30d), Weekly (12w)
     * - Rankings: Yesterday, Weekly, Yearly Top 10
     */
    async getDashboardAnalytics() {
        if (this._dashboardCache) {
            console.log("[Cache] Dashboard HIT");
            return this._dashboardCache;
        }
        console.time("getDashboardAnalytics");

        // 1. Get Latest Date (Anchor)
        const { data: latestData, error: latestError } = await supabase
            .from('daily_sales')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (latestError && latestError.code !== 'PGRST116') throw latestError; // PGRST116 = No rows
        if (!latestData) return null; // No data at all

        // Enforce strict YYYY-MM-DD format (10 chars)
        const anchorDateStr = latestData.date.substring(0, 10);
        const anchorDate = new Date(anchorDateStr);

        // Helper for date math (YYYY-MM-DD input/output)
        const shiftDate = (baseDateStr: string, days: number) => {
            const d = new Date(baseDateStr);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        };

        const currentYear = anchorDateStr.substring(0, 4);
        const startOfYear = `${currentYear}-01-01`;
        const startOfMonth = `${anchorDateStr.substring(0, 7)}-01`;

        // Weekly Range (Fri-Thu cycle) relative to Anchor
        const dayOfWeek = anchorDate.getDay(); // 0=Sun, 5=Fri
        const diffToFri = (dayOfWeek + 2) % 7;
        const startOfWeekStr = shiftDate(anchorDateStr, -diffToFri);

        // Helper to fetch all rows in PARALLEL batches
        const fetchAllParallel = async <T>(table: string, select: string, order?: string) => {
            // 1. Get Count first
            const { count, error: countError } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;
            if (!count) return [];

            const total = count;
            const BATCH_SIZE = 1000;
            const CONCURRENT_LIMIT = 5;
            const allData: T[] = [];

            const ranges: { from: number, to: number }[] = [];
            for (let i = 0; i < total; i += BATCH_SIZE) {
                ranges.push({ from: i, to: Math.min(i + BATCH_SIZE - 1, total - 1) });
            }

            for (let i = 0; i < ranges.length; i += CONCURRENT_LIMIT) {
                const chunkRanges = ranges.slice(i, i + CONCURRENT_LIMIT);
                const promises = chunkRanges.map(r => {
                    let q = supabase.from(table).select(select).range(r.from, r.to);
                    if (order) q = q.order(order);
                    return q;
                });

                const results = await Promise.all(promises);
                results.forEach(res => {
                    if (res.error) throw res.error;
                    if (res.data) allData.push(...(res.data as T[]));
                });
            }
            return allData;
        };

        // 2. Fetch Sales Data (Parallel)
        const sales = await fetchAllParallel<{ date: string, quantity: number, barcode: string }>('daily_sales', 'date, quantity, barcode', 'date');

        // 3. Fetch Product Metadata (for Rankings)
        // 3. Fetch Product Metadata (for Rankings) - PAGINATED
        // 3. Fetch Product Metadata (for Rankings) - PAGINATED
        const products_all = await fetchAllParallel<{ barcode: string, name: string, image_url: string, current_stock?: number, hq_stock?: number }>('products', 'barcode, name, image_url, current_stock, hq_stock', 'barcode');
        const productMap = new Map(products_all.map(p => [p.barcode, p]));

        // 4. Aggregation
        let statYesterday = 0; // Latest Date Sales
        let statWeekly = 0;
        let statMonthly = 0;
        let statYearly = 0;

        const dailyTrendMap = new Map<string, number>();
        const weeklyTrendMap = new Map<string, number>();

        // Rank by Product Name (Grouped)
        // Rank by Product Name (Grouped)
        const rankYesterday = new Map<string, number>();
        const rankYesterdayPrev = new Map<string, number>(); // [NEW] Previous Day

        const rankWeekly = new Map<string, number>();
        const rankWeeklyPrev = new Map<string, number>(); // [NEW] Previous Week

        const rankMonthly = new Map<string, number>();
        const rankMonthlyPrev = new Map<string, number>(); // [NEW] Previous Month

        const rankYearly = new Map<string, number>();
        const nameMetadata = new Map<string, { image?: string }>();

        sales?.forEach(s => {
            // Filter: Only include registered products (matches Product Status logic)
            const product = productMap.get(s.barcode);
            if (!product) return;

            const dateFull = s.date;
            const date = dateFull.substring(0, 10); // Strict YYYY-MM-DD
            const qty = s.quantity;
            const productName = product.name;

            // Capture metadata (first image found for name)
            if (!nameMetadata.has(productName)) {
                nameMetadata.set(productName, { image: product.image_url });
            }

            // Metrics
            // Previous Period Ranges
            // 1. Prev Day
            const prevDayStr = shiftDate(anchorDateStr, -1);
            if (date === anchorDateStr) {
                statYesterday += qty;
                rankYesterday.set(productName, (rankYesterday.get(productName) || 0) + qty);
            } else if (date === prevDayStr) {
                rankYesterdayPrev.set(productName, (rankYesterdayPrev.get(productName) || 0) + qty);
            }

            // 2. Weekly & Prev Weekly
            // Current Week: >= startOfWeekStr (Already defined)
            // Prev Week: (startOfWeekStr - 7) ~ (startOfWeekStr - 1)
            const startOfPrevWeekStr = shiftDate(startOfWeekStr, -7);

            if (date >= startOfWeekStr) {
                statWeekly += qty;
                rankWeekly.set(productName, (rankWeekly.get(productName) || 0) + qty);
            } else if (date >= startOfPrevWeekStr && date < startOfWeekStr) {
                rankWeeklyPrev.set(productName, (rankWeeklyPrev.get(productName) || 0) + qty);
            }

            // 3. Monthly & Prev Monthly
            // Current Month: >= startOfMonth
            // Prev Month: (startOfMonth - 1 month) ~ (startOfMonth - 1 day)
            // Simple logic: check year/month string
            const currentMonthPrefix = anchorDateStr.substring(0, 7); // YYYY-MM

            const prevMonthDate = new Date(startOfMonth);
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonthPrefix = prevMonthDate.toISOString().substring(0, 7); // YYYY-MM (prev)

            const rowMonthPrefix = date.substring(0, 7);

            if (rowMonthPrefix === currentMonthPrefix) {
                statMonthly += qty;
                rankMonthly.set(productName, (rankMonthly.get(productName) || 0) + qty);
            } else if (rowMonthPrefix === prevMonthPrefix) {
                rankMonthlyPrev.set(productName, (rankMonthlyPrev.get(productName) || 0) + qty);
            }

            if (date >= startOfYear) {
                statYearly += qty;
                rankYearly.set(productName, (rankYearly.get(productName) || 0) + qty);
            }

            // Daily Trend (Filtered)
            dailyTrendMap.set(date, (dailyTrendMap.get(date) || 0) + qty);

            // Weekly Trend (Group by Friday) (Filtered)
            const jsDate = new Date(date);
            const sDay = jsDate.getDay();
            const sDiff = (sDay + 2) % 7;
            const friStr = shiftDate(date, -sDiff);
            weeklyTrendMap.set(friStr, (weeklyTrendMap.get(friStr) || 0) + qty);
        });

        // 5. Format Data
        const getTop10 = (map: Map<string, number>, prevMap?: Map<string, number>) => {
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by quantity DESC
                .slice(0, 10)
                .map(([name, qty], index) => {
                    const prevQty = prevMap ? (prevMap.get(name) || 0) : 0;
                    const trend = prevMap ? (qty - prevQty) : null;

                    return {
                        rank: index + 1,
                        barcode: name, // Use Name as ID for UI keys
                        name: name,
                        imageUrl: nameMetadata.get(name)?.image,
                        quantity: qty,
                        abcGrade: 'A', // Default abcGrade
                        trend: trend // Add trend
                    };
                });
        };

        const sortedDaily = Array.from(dailyTrendMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-30); // Last 30 days from Anchor

        const sortedWeekly = Array.from(weeklyTrendMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12); // Last 12 weeks from Anchor

        // 6. Inventory Ranking (Top Stock)
        const inventoryMap = new Map<string, number>();
        products_all.forEach(p => {
            // User requested Coupang Stock Only (current_stock)
            const coupangStock = p.current_stock || 0;
            inventoryMap.set(p.name, (inventoryMap.get(p.name) || 0) + coupangStock);

            if (!nameMetadata.has(p.name)) {
                nameMetadata.set(p.name, { image: p.image_url });
            }
        });

        const rankInventory = getTop10(inventoryMap);

        // 7. Stockout Risk Alert (Opportunity Loss)
        // Logic: products with currentStock > 0 AND avgDailySales > 0 AND (currentStock / avgDailySales) <= 3
        const riskItems: any[] = [];

        // Calculate daily sales per product (last 7 days from ANCHOR DATE)
        // Critical: Must use anchorDateStr (latest data date) not Today, otherwise old data shows 0 sales.
        const productSalesStats = new Map<string, number>(); // Name -> Total Sales (7d)

        const anchorDateObj = new Date(anchorDateStr);
        const startOfRiskPeriod = new Date(anchorDateObj);
        startOfRiskPeriod.setDate(startOfRiskPeriod.getDate() - 7);
        const startOfRiskStr = startOfRiskPeriod.toISOString().split('T')[0];

        console.log(`[Risk Alert] Calculating risk for period: ${startOfRiskStr} ~ ${anchorDateStr}`);

        // Fetch ALL sales for the period (Handle Supabase 1000 row limit)
        const recentSales: { barcode: string, quantity: number }[] = [];
        let rFrom = 0;
        const rStep = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('daily_sales')
                .select('barcode, quantity')
                .gte('date', startOfRiskStr)
                .lte('date', anchorDateStr)
                .range(rFrom, rFrom + rStep - 1);

            if (error) {
                console.error("Error fetching recent sales:", error);
                break;
            }
            if (!data || data.length === 0) break;

            recentSales.push(...data);
            if (data.length < rStep) break;
            rFrom += rStep;
        }

        if (recentSales.length > 0) {
            // We need a map of Barcode -> Name because inventoryMap is by Name.
            // But we don't have a direct Barcode->Name map readily available in this scope efficiently without reiterating products.
            // Let's build it quickly.
            const barcodeToName = new Map<string, string>();
            products_all.forEach(p => barcodeToName.set(p.barcode, p.name));

            recentSales.forEach(s => {
                const pName = barcodeToName.get(s.barcode);
                if (pName) {
                    productSalesStats.set(pName, (productSalesStats.get(pName) || 0) + s.quantity);
                }
            });
        }

        inventoryMap.forEach((stock, name) => {
            if (stock <= 0) return; // Already OOS is not "Risk", it's "Problem". We focus on "Imminent".

            const sales7d = productSalesStats.get(name) || 0;
            if (sales7d === 0) return; // No sales, no risk

            const avgDaily = sales7d / 7;
            const daysLeft = stock / avgDaily;

            if (daysLeft <= 3) {
                // Deduplicate
                const existingIndex = riskItems.findIndex(r => r.name === name);
                if (existingIndex === -1) {
                    riskItems.push({
                        name: name,
                        imageUrl: nameMetadata.get(name)?.image,
                        currentStock: stock,
                        avgDailySales: Math.round(avgDaily * 10) / 10,
                        daysLeft: Math.round(daysLeft * 10) / 10
                    });
                }
            }
        });

        console.log(`[Risk Alert] Final Risk Items: ${riskItems.length}`, riskItems.slice(0, 3));

        // Sort by impact (Avg Daily Sales DESC)
        riskItems.sort((a, b) => b.avgDailySales - a.avgDailySales);

        const result = {
            anchorDate: anchorDateStr,
            metrics: {
                yesterday: statYesterday,
                weekly: statWeekly,
                monthly: statMonthly,
                yearly: statYearly
            },
            trends: {
                daily: sortedDaily.map(([date, quantity]) => ({ date: date.substring(5), quantity })),
                weekly: sortedWeekly.map(([date, quantity]) => ({ date: date.substring(5), quantity }))
            },
            rankings: {
                yesterday: getTop10(rankYesterday, rankYesterdayPrev),
                weekly: getTop10(rankWeekly, rankWeeklyPrev),
                monthly: getTop10(rankMonthly, rankMonthlyPrev),
                yearly: getTop10(rankYearly),
                inventory: rankInventory
            },
            riskItems: riskItems
        };

        this._dashboardCache = result; // Cache the result
        console.timeEnd("getDashboardAnalytics");
        return result;
    },

    /**
     * Fetch Product List with Sales & Inventory Data
     * Used for 'Product Status' and 'Inventory Status' tabs
     */
    async getProductStats(): Promise<ProductStats[]> {
        if (this._productStatsCache) {
            console.log("[Cache] ProductStats HIT");
            return this._productStatsCache;
        }
        console.time("getProductStats");

        // Helper to fetch all rows in PARALLEL batches
        const fetchAllParallel = async <T>(table: string, select: string, order?: string) => {
            // 1. Get Count first
            const { count, error: countError } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;
            if (!count) return [];

            const total = count;
            const BATCH_SIZE = 1000;
            const CONCURRENT_LIMIT = 5; // Simpler parallel limit
            const allData: T[] = [];

            // Generate ranges
            const ranges: { from: number, to: number }[] = [];
            for (let i = 0; i < total; i += BATCH_SIZE) {
                ranges.push({ from: i, to: Math.min(i + BATCH_SIZE - 1, total - 1) });
            }

            // Fetch in chunks
            for (let i = 0; i < ranges.length; i += CONCURRENT_LIMIT) {
                const chunkRanges = ranges.slice(i, i + CONCURRENT_LIMIT);
                const promises = chunkRanges.map(r => {
                    let q = supabase.from(table).select(select).range(r.from, r.to);
                    if (order) q = q.order(order);
                    return q;
                });

                const results = await Promise.all(promises);
                results.forEach(res => {
                    if (res.error) throw res.error;
                    if (res.data) allData.push(...(res.data as T[]));
                });
            }
            return allData;
        };

        // 1. Fetch Products (Master + Stock)
        // [FIX] Use fetchAllParallel to get ALL products (bypass 1000 limit)
        const products = await fetchAllParallel<{ barcode: string, name: string, option_value: string, season: string, image_url: string, hq_stock: number, current_stock: number, safety_stock: number, incoming_stock: number }>(
            'products',
            'barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock',
            'barcode'
        );

        if (!products) return []; // Ensure products is an array for subsequent operations

        // 2. Fetch Sales History (Last 30 Days for trends)
        // Note: For daily_sales, getting exact count might be slow if huge, but faster than serial fetch.
        const sales = await fetchAllParallel<{ date: string, quantity: number, barcode: string }>('daily_sales', 'barcode, quantity, date', 'date');

        // ... existing aggregation logic ...
        // 3. Aggregate Sales (Anchor to Latest Date)
        const salesMap = new Map<string, { total: number, last14Days: number, last7Days: number, yesterday: number, daily: Record<string, number> }>();

        // Find latest date from sales data itself to be accurate without extra query if possible?
        let maxDateStr = '';
        sales.forEach(s => {
            if (s.date > maxDateStr) maxDateStr = s.date;
        });

        // Calculate ranges
        const anchorDate = maxDateStr ? new Date(maxDateStr) : new Date();

        const toLocalISO = (d: Date) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
        };

        const dateYesterday = toLocalISO(anchorDate); // Latest date is "yesterday" contextually

        const d7 = new Date(anchorDate); d7.setDate(anchorDate.getDate() - 6);
        const date7DaysAgo = toLocalISO(d7);

        const d14 = new Date(anchorDate); d14.setDate(anchorDate.getDate() - 13);
        const date14DaysAgo = toLocalISO(d14);

        sales?.forEach(s => {
            const entry = salesMap.get(s.barcode) || { total: 0, last14Days: 0, last7Days: 0, yesterday: 0, daily: {} };
            entry.total += s.quantity;

            // Ranges
            if (s.date >= date14DaysAgo) entry.last14Days += s.quantity;
            if (s.date >= date7DaysAgo) entry.last7Days += s.quantity;
            if (s.date === dateYesterday) entry.yesterday += s.quantity;

            // Aggregate daily sales
            entry.daily[s.date] = (entry.daily[s.date] || 0) + s.quantity;

            salesMap.set(s.barcode, entry);
        });

        // 4. Merge
        const result = products.map(p => {
            const s = salesMap.get(p.barcode) || { total: 0, last14Days: 0, last7Days: 0, yesterday: 0, daily: {} };
            const avgDailySales = s.last7Days / 7;
            const daysOfInventory = avgDailySales > 0 ? Math.round(p.current_stock / avgDailySales) : 999;

            // Trend Calculation
            const prevSales7Days = s.last14Days - s.last7Days;

            // Monthly Sales (Approx last 30 days)            
            // 1. Yesterday Trend
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

            const dayBeforeDate = new Date();
            dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
            const dayBeforeStr = dayBeforeDate.toISOString().split('T')[0];

            const qtyYesterday = s.daily[yesterdayStr] || 0;
            const qtyDayBefore = s.daily[dayBeforeStr] || 0;
            const trendYesterday = qtyYesterday - qtyDayBefore; // Simple diff

            // 2. Weekly Trend (Last 7 Days vs Previous 7 Days)
            // Already have prevSales7Days.
            const trendWeek = s.last7Days - prevSales7Days;

            // 3. Monthly Trend (Last 30 Days vs Previous 30 Days)
            // We need to loop daily sales.
            let sales30Days = 0;
            let salesPrev30Days = 0;

            const now = new Date();
            for (let i = 0; i < 60; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - (i + 1)); // start from yesterday backwards
                const dStr = d.toISOString().split('T')[0];
                const qty = s.daily[dStr] || 0;

                if (i < 30) sales30Days += qty;
                else salesPrev30Days += qty;
            }
            const trendMonth = sales30Days - salesPrev30Days;

            let trend: 'hot' | 'cold' | 'up' | 'down' | 'flat' = 'flat';

            const diff = s.last7Days - prevSales7Days;
            const rate = prevSales7Days > 0 ? diff / prevSales7Days : 0; // Growth rate

            if (rate >= 0.5 && s.last7Days >= 10) trend = 'hot';
            else if (rate <= -0.5 && prevSales7Days >= 10) trend = 'cold';
            else if (diff > 0) trend = 'up';
            else if (diff < 0) trend = 'down';

            return {
                barcode: p.barcode,
                name: p.name,
                option: p.option_value, // Map DB column to API field
                season: p.season || '정보없음',
                imageUrl: p.image_url,
                hqStock: p.hq_stock || 0,
                coupangStock: p.current_stock || 0, // Alias
                incomingStock: p.incoming_stock || 0, // [NEW]
                safetyStock: p.safety_stock || 10,
                totalSales: s.total,
                sales14Days: s.last14Days,
                sales7Days: s.last7Days,
                salesYesterday: s.yesterday,
                sales30Days,
                trends: {
                    yesterday: trendYesterday,
                    week: trendWeek,
                    month: trendMonth
                },
                avgDailySales: parseFloat(avgDailySales.toFixed(1)),
                daysOfInventory,
                dailySales: s.daily,
                abcGrade: 'D' as 'A' | 'B' | 'C' | 'D', // Default, will be updated below
                prevSales7Days,
                trend
            };
        });

        // 5. ABC Analysis (Based on sales7Days)
        // Sort by sales7Days DESC
        result.sort((a, b) => b.sales7Days - a.sales7Days);

        const totalSales7Days = result.reduce((sum, p) => sum + p.sales7Days, 0);
        let cumulativeSales = 0;

        result.forEach(p => {
            if (p.sales7Days <= 0) {
                p.abcGrade = 'D';
                return;
            }

            cumulativeSales += p.sales7Days;
            const percentage = (cumulativeSales / totalSales7Days) * 100;

            if (percentage <= 20) {
                p.abcGrade = 'A';
            } else if (percentage <= 50) {
                p.abcGrade = 'B';
            } else {
                p.abcGrade = 'C';
            }
        });

        this._productStatsCache = result; // Cache the result
        console.timeEnd("getProductStats");
        return result;
    },
    /**
     * Reset Data (Clear Sales & Stock)
     * Used to clean up bad data (e.g. impossible dates)
     */
    async resetData() {
        this.clearCache(); // Invalidate cache
        // 1. Delete all daily_sales
        // Using neq match on a column that is likely not null/empty
        const { error: deleteError } = await supabase
            .from('daily_sales')
            .delete()
            .neq('barcode', 'RESET_ALL'); // Ideally matches all if barcode != 'RESET_ALL'

        if (deleteError) throw deleteError;

        // 2. Reset Stock to 0
        const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: 0, hq_stock: 0 })
            .neq('barcode', 'RESET_ALL');

        if (updateError) throw updateError;

        return true;
    }
};
