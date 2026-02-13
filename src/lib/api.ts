import { supabase } from './supabase';
import type { ProductMaster, CoupangSalesRow } from './parsers';

export interface ProductStats {
    barcode: string;
    name: string;
    season: string;
    imageUrl?: string;
    hqStock: number;       // From Product Master (Col U)
    coupangStock: number;  // From Sales File (Col N, latest)
    safetyStock: number;   // From Product Master
    totalSales: number;
    sales14Days: number;   // Last 14 days
    sales7Days: number;    // Last 7 days
    salesYesterday: number;// Latest date sales
    avgDailySales: number; // Last 7 days avg
    daysOfInventory: number;
    dailySales: Record<string, number>; // Date (YYYY-MM-DD) -> Quantity
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
                // If the same product appears multiple times on the same date (e.g. diff warehouses), sum the stock
                existing.currentStock += row.currentStock;
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

        let maxDate = '';
        uniqueSales.forEach(row => {
            if (row.date > maxDate) maxDate = row.date;
        });

        const stockMap = new Map<string, number>();

        // Only sum stock from the latest date found in file
        uniqueSales.forEach(row => {
            if (row.date === maxDate) {
                const current = stockMap.get(row.barcode) || 0;
                // Accumulate stock (in case multiple rows for same barcode on same day)
                stockMap.set(row.barcode, current + (row.currentStock || 0));
            }
        });

        const stockUpdates = Array.from(stockMap.entries()).map(([barcode, stock]) => ({
            barcode,
            current_stock: stock,
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
- 기준 날짜(재고반영): ${maxDate || '없음'}
- 재고 업데이트 대상: ${stockUpdates.length}개 품목
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
        const rankWeekly = new Map<string, number>();
        const rankMonthly = new Map<string, number>(); // [NEW]
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
            if (date === anchorDateStr) {
                statYesterday += qty;
                rankYesterday.set(productName, (rankYesterday.get(productName) || 0) + qty);
            }
            if (date >= startOfWeekStr) {
                statWeekly += qty;
                rankWeekly.set(productName, (rankWeekly.get(productName) || 0) + qty);
            }
            if (date >= startOfMonth) {
                statMonthly += qty;
                rankMonthly.set(productName, (rankMonthly.get(productName) || 0) + qty); // [NEW]
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
        const getTop10 = (map: Map<string, number>) => {
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, qty], index) => {
                    return {
                        rank: index + 1,
                        barcode: name, // Use Name as ID for UI keys
                        name: name,
                        imageUrl: nameMetadata.get(name)?.image,
                        quantity: qty
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
                yesterday: getTop10(rankYesterday),
                weekly: getTop10(rankWeekly),
                monthly: getTop10(rankMonthly),
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

        // 1. Fetch valid products
        const products = await fetchAllParallel<any>('products', 'barcode, name, season, image_url, current_stock, hq_stock, safety_stock', 'barcode');
        if (!products) return [];

        // 2. Fetch Sales Data (ALL History)
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

            return {
                barcode: p.barcode,
                name: p.name,
                season: p.season || '정보없음',
                imageUrl: p.image_url,
                hqStock: p.hq_stock || 0,
                coupangStock: p.current_stock, // Alias
                safetyStock: p.safety_stock || 0,
                totalSales: s.total,
                sales14Days: s.last14Days,
                sales7Days: s.last7Days,
                salesYesterday: s.yesterday,
                avgDailySales: parseFloat(avgDailySales.toFixed(1)),
                daysOfInventory,
                dailySales: s.daily
            };
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
