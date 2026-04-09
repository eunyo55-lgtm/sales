import { supabase } from './supabase';
import type { ProductMaster, CoupangSalesRow, IncomingStockRow, HistoricalSalesRow, CoupangOrderRow } from './parsers';

export interface ProductStats {
    barcode: string;
    name: string;
    option?: string; // New: Option Value
    season: string;
    imageUrl?: string;
    hqStock: number;       // From Product Master (Col U)
    coupangStock: number;  // From Sales File (Col N, latest)
    fcStock: number;       // [NEW]
    vfStock: number;       // [NEW]
    incomingStock: number; // [NEW] From Supply In Progress File
    safetyStock: number;   // From Product Master
    totalSales: number;
    fcSales: number;       // [NEW]
    vfSales: number;       // [NEW]
    sales14Days: number;   // Last 14 days
    sales7Days: number;    // Last 7 days
    salesYesterday: number;// Latest date sales
    avgDailySales: number; // Last 7 days avg
    daysOfInventory: number;
    cost: number;          // [NEW]
    dailySales: Record<string, number>; // Date (YYYY-MM-DD) -> Quantity
    dailyStock: Record<string, number>; // [NEW] Date (YYYY-MM-DD) -> Total Stock
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
    _dashboardPromise: null as Promise<any> | null,
    _productStatsCache_Map: new Map<string, ProductStats[]>() as Map<string, ProductStats[]>,
    _productStatsPromise_Map: new Map<string, Promise<ProductStats[]>>() as Map<string, Promise<ProductStats[]>>,
    _rawProductsPromise: null as Promise<any[]> | null,
    _rawDailySalesPromise: null as Promise<any[]> | null,
    _rawDailySalesPromiseMap: new Map<string, Promise<any>>(),
    _summaryPromise: null as Promise<any> | null,
    _trendsPromise: null as Promise<any> | null,
    _excludedKeywords: ["부자재", "사은품", "우일신", "일상화보", "매장", "수선 재발송"],

    // Analytics Materialized View Refresh Trigger
    async refreshAnalyticsCache() {
        try {
            console.log("[API] Refreshing Materialized Views...");
            await supabase.rpc('refresh_analytics_mvs');
            console.log("[API] MV Cache Refreshed Successfully.");
        } catch (e) {
            console.error("[API] Failed to refresh MV cache:", e);
        }
    },

    async _fetchRPCParallel<T>(rpcName: string, params: object) {
        const BATCH_SIZE = 1000;
        const allData: T[] = [];
        let i = 0;
        const CONCURRENCY = 6;
        let isDone = false;

        console.time(`[API] Parallel RPC: ${rpcName}`);
        while (!isDone) {
            const batchPromises = [];
            for (let c = 0; c < CONCURRENCY; c++) {
                batchPromises.push(supabase.rpc(rpcName, {
                    ...params,
                    limit_val: BATCH_SIZE,
                    offset_val: i + (c * BATCH_SIZE)
                }));
            }

            const results = await Promise.all(batchPromises);

            for (let c = 0; c < CONCURRENCY; c++) {
                const { data, error } = results[c];
                if (error) {
                    console.error(`[API] RPC Fetch error in ${rpcName}: `, error);
                    throw error;
                }

                if (data && data.length > 0) {
                    allData.push(...(data as T[]));
                }

                if (!data || data.length < BATCH_SIZE) {
                    isDone = true;
                    break;
                }
            }
            i += (CONCURRENCY * BATCH_SIZE);
            if (i > 100000) break;
        }
        console.timeEnd(`[API] Parallel RPC: ${rpcName}`);
        console.log(`[API] Total rows fetched from ${rpcName}: ${allData.length}`);
        return allData;
    },


    async _fetchAllParallel<T>(table: string, select: string, order?: string, filterBuilder?: (q: any) => any) {
        const BATCH_SIZE = 1000;
        const allData: T[] = [];
        let i = 0;

        // Optional: First get the count if no filterBuilder to determine exact bounds? 
        // Or just fire parallel batches. We'll use a dynamic parallel approach: 
        // Fire 5 requests at a time until we hit a batch < BATCH_SIZE.
        // Fire 3 requests at a time until we hit a batch < BATCH_SIZE (Safely avoiding timeouts)
        const CONCURRENCY = 3;
        let isDone = false;

        while (!isDone) {
            const batchPromises = [];
            for (let c = 0; c < CONCURRENCY; c++) {
                let q = supabase.from(table).select(select);
                if (filterBuilder) q = filterBuilder(q);
                q = q.range(i + (c * BATCH_SIZE), i + (c * BATCH_SIZE) + BATCH_SIZE - 1);
                if (order) q = q.order(order);
                else q = q.order('created_at', { ascending: false }); // Default stable sort
                batchPromises.push(q);
            }

            const results = await Promise.all(batchPromises);

            for (let c = 0; c < CONCURRENCY; c++) {
                const { data, error } = results[c];
                if (error) {
                    console.error(`[API] Fetch error in ${table}: `, error);
                    throw error;
                }

                if (data && data.length > 0) {
                    allData.push(...(data as T[]));
                }

                // If any chunk returned less than BATCH_SIZE, this is the final tail
                if (!data || data.length < BATCH_SIZE) {
                    isDone = true;
                    break;
                }
            }
            i += (CONCURRENCY * BATCH_SIZE);
        }
        return allData;
    },

    async _getLatestDateCore() {
        try {
            const { data, error } = await supabase.rpc('get_latest_data_date');
            if (error) throw error;
            return data || new Date().toISOString().split('T')[0];
        } catch (e) {
            console.error("[API] get_latest_data_date failed, falling back to manual fetch", e);
            const { data } = await supabase.from('daily_sales').select('date').order('date', { ascending: false }).limit(1).single();
            return data?.date.substring(0, 10) || new Date().toISOString().split('T')[0];
        }
    },

    async _getRawProducts() {
        if (this._rawProductsPromise) return this._rawProductsPromise;
        const promise = this._fetchAllParallel<any>(
            'products',
            'barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock, fc_stock, vf_stock, cost',
            'barcode'
        );
        this._rawProductsPromise = promise;
        try {
            const allProducts = await promise;
            return allProducts.filter(p => {
                if (!p.name || !p.barcode) return false;
                
                // 1. User-specified excluded keywords
                const isExcluded = this._excludedKeywords.some(kw => p.name.includes(kw));
                if (isExcluded) return false;

                // 2. Filter out items with HTML/CSS contamination (e.g. barcode 'S99742')
                const isMalformed = (p.season && (p.season.includes('<td') || p.season.includes('white-space'))) ||
                                    (p.name && (p.name.includes('<td') || p.name.includes('white-space')));
                
                return !isMalformed;
            });
        } catch (e) {
            this._rawProductsPromise = null;
            throw e;
        }
    },

    async _getRawDailySales(startDate?: string) {
        const key = startDate || 'ALL';
        if (this._rawDailySalesPromiseMap.has(key)) return this._rawDailySalesPromiseMap.get(key);

        const promise = this._fetchAllParallel<any>(
            'daily_sales',
            'date, quantity, barcode, fc_quantity, vf_quantity, stock',
            'date',
            startDate ? (q) => q.gte('date', startDate) : undefined
        );
        this._rawDailySalesPromiseMap.set(key, promise);

        try {
            return await promise;
        } catch (e) {
            this._rawDailySalesPromiseMap.delete(key);
            throw e;
        }
    },

    /**
     * Identifies barcodes in daily_sales that are missing from products table
     * and auto-registers them to ensure they appear in the UI.
     */
    async syncMissingBarcodes() {
        console.log("[API] Syncing missing barcodes...");

        // 1. Get unique barcodes from daily_sales (last 90 days to be efficient) - PAGINATED
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

        const salesData = await this._fetchAllParallel<{ barcode: string }>(
            'daily_sales',
            'barcode',
            'barcode',
            (q) => q.gte('date', dateStr)
        );

        if (!salesData) return;
        const uniqueSalesBarcodes = Array.from(new Set(salesData.map(s => s.barcode)));

        // 2. Get all existing product barcodes
        const products = await this._getRawProducts();
        const existingBarcodes = new Set(products.map(p => p.barcode));

        // 3. Find missing
        const missing = uniqueSalesBarcodes.filter(b => b && !existingBarcodes.has(b));

        if (missing.length === 0) {
            console.log("[API] No missing barcodes found.");
            return;
        }

        console.log(`[API] Registering ${missing.length} missing barcodes...`);

        /* 
    async syncMissingBarcodes() {
        // [DEPRECATED] This function fetches ~116k rows and causes massive latency.
        // It's not currently used in the main flow.
        const latestData = await this._getLatestDateCore();
        const dateStr = latestData;
        const salesData = await this._fetchRPCParallel<{ barcode: string }>('daily_sales', 'barcode', 'barcode', (q) => q.gte('date', dateStr));
        // ... rest removed for performance
    },
    */

        const CHUNK_SIZE = 500;
        for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
            const chunk = missing.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('products')
                .upsert(
                    chunk.map(barcode => ({
                        barcode,
                        name: barcode, // Use barcode as name so they don't all group together as "미등록 상품"
                        option_value: '미등록',
                        season: '정보없음',
                        updated_at: new Date().toISOString()
                    })),
                    { onConflict: 'barcode', ignoreDuplicates: true }
                );
            if (error) console.error("[API] Error syncing barcodes:", error);
        }

        this._rawProductsPromise = null; // Invalidate cache
    },

    /**
     * Clear Cache (Call on data updates)
     */
    clearCache() {
        this._dashboardCache = null;
        this._dashboardPromise = null;
        this._productStatsCache_Map.clear();
        this._productStatsPromise_Map.clear();
        this._rawProductsPromise = null;
        this._rawDailySalesPromiseMap.clear();
        
        // Also clear persistent session storage
        try {
            sessionStorage.removeItem('DASHBOARD_FULL');
            sessionStorage.removeItem('DASHBOARD_FULL_V3');
        } catch(e) {}
    },

    /**
     * Upload Product Master Data to Supabase
     */
    async uploadProducts(products: ProductMaster[], onProgress?: (progress: number) => void) {
        this.clearCache(); // Invalidate cache
        if (products.length === 0) return;

        // DEBUG: Check first item
        const sample = products[0];
        alert(`[데이터 확인]\n첫 번째 상품 파싱 결과: \n이름: ${sample.name} \n옵션(D열): ${sample.option} \n바코드: ${sample.barcode} \n\n옵션이 '옵션없음'으로 보이면 D열이 비어있거나 다른 열일 수 있습니다.`);

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
                        hq_stock: p.hqStock || 0,
                        cost: p.cost || 0, // [NEW] Save cost to DB
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
        // Deduplicate sales data
        // We now need to track fcQty and vfQty separately
        // We now need to track fcQty and vfQty separately, and track the maximum currentStock for that day
        const aggregatedSalesMap = new Map<string, CoupangSalesRow & { fcQty: number, vfQty: number, maxStock: number }>();
        salesData.forEach(row => {
            const key = `${row.date}_${row.barcode}`;
            const existing = aggregatedSalesMap.get(key);

            const isFC = row.center === 'FC';
            const isVF = row.center === 'VF164';

            if (existing) {
                existing.salesQty += row.salesQty;
                if (isFC) existing.fcQty += row.salesQty;
                if (isVF) existing.vfQty += row.salesQty;

                if (row.currentStock > 0) {
                    existing.maxStock += row.currentStock; // Summing the stock from different centers for the daily total stock
                }
            } else {
                aggregatedSalesMap.set(key, {
                    ...row,
                    fcQty: isFC ? row.salesQty : 0,
                    vfQty: isVF ? row.salesQty : 0,
                    maxStock: row.currentStock // initialize with current stock
                });
            }
        });

        const uniqueSales = Array.from(aggregatedSalesMap.values());

        // 0. Ensure all products exist in 'products' table to avoid FK error
        const uniqueBarcodes = Array.from(new Set(uniqueSales.map(s => s.barcode)));

        const PROD_CHUNK_SIZE = 500;
        let setupProcessed = 0;
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

            setupProcessed += barcodeChunk.length;
            if (onProgress) onProgress(Math.round((setupProcessed / uniqueBarcodes.length) * 10)); // 0~10% range for setup
        }

        const CHUNK_SIZE = 500; // Reduced to prevent URI too long
        const total = uniqueSales.length;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = uniqueSales.slice(i, i + CHUNK_SIZE);
            const chunkDates = Array.from(new Set(chunk.map(c => c.date)));
            const chunkBarcodes = Array.from(new Set(chunk.map(c => c.barcode)));

            // Pre-fetch existing daily_sales to prevent wiping FC/VF quantities when uploading one-by-one
            const { data: existingSales } = await supabase
                .from('daily_sales')
                .select('date, barcode, fc_quantity, vf_quantity, stock')
                .in('date', chunkDates)
                .in('barcode', chunkBarcodes);

            const existingSalesMap = new Map();
            existingSales?.forEach(s => existingSalesMap.set(`${s.date}_${s.barcode}`, s));

            const { error } = await supabase
                .from('daily_sales')
                .upsert(
                    chunk.map(s => {
                        const existing = existingSalesMap.get(`${s.date}_${s.barcode}`);
                        return {
                            date: s.date,
                            barcode: s.barcode,
                            quantity: s.salesQty,
                            fc_quantity: s.fcQty > 0 || !existing ? s.fcQty : existing.fc_quantity,
                            vf_quantity: s.vfQty > 0 || !existing ? s.vfQty : existing.vf_quantity,
                            stock: s.maxStock > 0 || !existing ? s.maxStock : (existing.stock || 0), // Save daily stock
                        };
                    }),
                    { onConflict: 'date, barcode' }
                );

            if (error) throw error;

            processed += chunk.length;
            // 10% ~ 50% range for sales data insertion
            if (onProgress) onProgress(10 + Math.round((processed / total) * 40));
        }

        // Update Product Stock Logic (Coupang Stock)
        // A열 가장 최신 날짜 기준 N열의 현재재고 값을 SUM으로 가져옵니다 (FC/VF164 구분).

        // 1. Find the latest date overall per barcode per center
        const latestDateMap = new Map<string, { fcDate: string, vfDate: string }>();
        salesData.forEach(row => {
            const current = latestDateMap.get(row.barcode) || { fcDate: '', vfDate: '' };
            if (row.center === 'FC') {
                if (row.date > current.fcDate) current.fcDate = row.date;
            } else if (row.center === 'VF164') {
                if (row.date > current.vfDate) current.vfDate = row.date;
            }
            latestDateMap.set(row.barcode, current);
        });

        // 2. Sum the stock for the latest date per center
        const stockMap = new Map<string, { fcStock: number, vfStock: number, hasFC: boolean, hasVF: boolean }>();
        salesData.forEach(row => {
            const latest = latestDateMap.get(row.barcode)!;
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

        // Pre-fetch existing products to avoid overwriting VF/FC stock when missing from the uploaded file
        const existingProductsMap = new Map<string, { fc_stock: number, vf_stock: number }>();
        const FETCH_BATCH_SIZE = 200; // Safe for URI
        const updatedBarcodes = Array.from(stockMap.keys());

        let stockFetchProcessed = 0;
        for (let i = 0; i < updatedBarcodes.length; i += FETCH_BATCH_SIZE) {
            const chunk = updatedBarcodes.slice(i, i + FETCH_BATCH_SIZE);
            const { data } = await supabase.from('products').select('barcode, fc_stock, vf_stock').in('barcode', chunk);
            if (data) {
                data.forEach(p => existingProductsMap.set(p.barcode, p));
            }
            stockFetchProcessed += chunk.length;
            // 50% ~ 60% range for fetching old stocks
            if (onProgress) onProgress(50 + Math.round((stockFetchProcessed / updatedBarcodes.length) * 10));
        }

        const stockUpdates = Array.from(stockMap.entries()).map(([barcode, data]) => {
            const existingProd = existingProductsMap.get(barcode);

            const fcTotalStock = data.hasFC ? data.fcStock : (existingProd?.fc_stock || 0);
            const vfTotalStock = data.hasVF ? data.vfStock : (existingProd?.vf_stock || 0);

            return {
                barcode,
                current_stock: fcTotalStock + vfTotalStock,
                fc_stock: fcTotalStock,
                vf_stock: vfTotalStock,
                updated_at: new Date().toISOString()
            };
        });

        // Sample Check for Debugging
        let sampleText = "데이터 없음";
        let nonZeroCount = 0;

        if (stockUpdates.length > 0) {
            const firstItems = stockUpdates.slice(0, 5);
            sampleText = firstItems.map(s => `[${s.barcode}]총재고: ${s.current_stock} (FC: ${s.fc_stock}, VF: ${s.vf_stock})`).join('\n');
            nonZeroCount = stockUpdates.filter(s => s.current_stock > 0).length;
        }

        // DEBUG ALERT to confirm logic
        if (typeof window !== 'undefined') {
            const msg = `[데이터 처리 완료 안내]
- 판매 데이터 ${uniqueSales.length}행 파싱 완료
    - 업데이트 대상 품목수: ${stockUpdates.length} 개
        - 재고 보유(> 0) 상태: ${nonZeroCount}개 품목

            (참고: 쿠팡 엑셀 상의 날짜별 합계 재고를 기준으로 가져옵니다.엑셀의 재고가 0인 상태가 최근 날짜라면 앱에서도 똑같이 0으로 반영됩니다.)

        [샘플 데이터 확인]
${sampleText}

* 확인을 누르면 저장을 시작합니다.`;
            alert(msg);
        }

        if (stockUpdates.length > 0) {
            let errorCount = 0;
            let successCount = 0;
            let lastError = '';

            // Reduced chunk size for parallel updates to avoid rate limits/timeouts
            // Since we cannot use upsert (missing constraints/ID), we iterate updates.
            const BATCH_SIZE = 20; // smaller to prevent browser lock

            let stockUpdateProcessed = 0;
            const totalUpdates = stockUpdates.length;

            for (let j = 0; j < totalUpdates; j += BATCH_SIZE) {
                const chunk = stockUpdates.slice(j, j + BATCH_SIZE);

                // Process chunk in parallel (update by barcode)
                const promises = chunk.map(item =>
                    supabase
                        .from('products')
                        .update({
                            current_stock: item.current_stock,
                            fc_stock: item.fc_stock,
                            vf_stock: item.vf_stock,
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

                stockUpdateProcessed += chunk.length;
                // 60% ~ 100% range
                if (onProgress) onProgress(60 + Math.round((stockUpdateProcessed / totalUpdates) * 40));
            }

            // TRIGGER MV REFRESH
            await this.refreshAnalyticsCache();

            if (typeof window !== 'undefined') {
                if (errorCount > 0) {
                    alert(`⚠️ 저장 중 일부 오류 발생(${errorCount}건 실패) \n마지막 오류: ${lastError} `);
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
     * Upload Historical Sales Data (Wide Format -> Long Format)
     * Inserts/Upserts daily_sales without touching stock columns.
     */
    async uploadHistoricalSales(historicalData: HistoricalSalesRow[], onProgress?: (progress: number) => void) {
        this.clearCache();
        if (historicalData.length === 0) return;

        // Group by barcode and date to avoid conflicts just in case
        const salesMap = new Map<string, number>();
        historicalData.forEach(row => {
            const key = `${row.barcode}_${row.date}`;
            salesMap.set(key, (salesMap.get(key) || 0) + row.salesQty);
        });

        // Fetch valid barcodes from the product master to prevent foreign key constraint errors
        const validProducts = await this._getRawProducts();
        const validBarcodes = new Set(validProducts.map(p => p.barcode));

        // Auto-register missing barcodes as '단종' (Discontinued)
        const missingBarcodes = new Set<string>();
        historicalData.forEach(row => {
            if (!validBarcodes.has(row.barcode)) {
                missingBarcodes.add(row.barcode);
            }
        });

        if (missingBarcodes.size > 0) {
            console.log(`[API] Auto-registering ${missingBarcodes.size} missing barcodes as '단종'`);
            const missingProductsPayload = Array.from(missingBarcodes).map(barcode => ({
                barcode,
                name: '단종',
                option_value: '단종',
                season: '단종',
                image_url: '',
                hq_stock: 0,
                updated_at: new Date().toISOString(),
            }));

            // Chunk the product upsert just in case there are thousands
            const PROD_CHUNK_SIZE = 500;
            for (let i = 0; i < missingProductsPayload.length; i += PROD_CHUNK_SIZE) {
                const chunk = missingProductsPayload.slice(i, i + PROD_CHUNK_SIZE);
                const { error: prodError } = await supabase
                    .from('products')
                    .upsert(chunk, { onConflict: 'barcode' });

                if (prodError) {
                    console.error("[API] Error auto-registering missing products:", prodError);
                    throw prodError;
                }
            }
        }

        const updates = Array.from(salesMap.entries())
            .map(([key, qty]) => {
                const [barcode, date] = key.split('_');
                return {
                    barcode,
                    date,
                    quantity: qty,
                    created_at: new Date().toISOString()
                };
            });

        const CHUNK_SIZE = 200; // Reduced from 1000 to prevent statement timeouts
        const total = updates.length;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);

            const { error } = await supabase
                .from('daily_sales')
                .upsert(chunk, { onConflict: 'barcode,date', ignoreDuplicates: false });

            if (error) {
                console.error("[API] Error uploading historical sales chunk:", error);
                throw error;
            }

            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));

            // Small delay to prevent overwhelming the DB connection pool
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // TRIGGER MV REFRESH
        await this.refreshAnalyticsCache();
    },

    /**
     * Fetch New Dashboard Insights (Winner/Loser/Category Trends)
     */
    async getDashboardInsights() {
        const { data: latestData } = await supabase
            .from('daily_sales')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .single();

        const anchorDateStr = latestData?.date.substring(0, 10) || new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.rpc('get_dashboard_insights', { anchor_date: anchorDateStr });

        if (error) {
            console.error("[API] getDashboardInsights error:", error);
            throw error;
        }

        // Add cost to winners/losers from raw products
        const products = await this._getRawProducts();
        const costMap = new Map(products.map(p => [p.name, p.cost]));

        const enhance = (items: any[]) => items?.map(item => ({
            ...item,
            cost: costMap.get(item.name || item.category) || 0
        })) || [];

        return {
            ...data,
            winners: enhance(data.winners),
            losers: enhance(data.losers)
        };
    },

    async getDashboardAnalytics(forceRefresh = false) {
        // This is a legacy wrapper. Progressive loading should use getDashboardSummary and getDashboardTrends.
        const summary = await this.getDashboardSummary(forceRefresh);
        const trends = await this.getDashboardTrends(forceRefresh);
        return { ...summary, trends };
    },

    async getDashboardSummary(forceRefresh = false) {
        if (!forceRefresh && this._dashboardCache && this._dashboardCache.metrics) return this._dashboardCache;
        if (this._summaryPromise) return this._summaryPromise;

        const promise = (async () => {
            try {
                // 1. Get Latest Date (Anchor)
                const { data: latestData } = await supabase
                    .from('daily_sales')
                    .select('date')
                    .order('date', { ascending: false })
                    .limit(1)
                    .single();

            // 1. Get Latest Date (Anchor) - Optimized via RPC
            const anchorDateStr = await this._getLatestDateCore();

            // 2. Fetch Aggregated Data in Parallel (V13 Optimization)
            const [summaryRes, trendsRes] = await Promise.all([
                supabase.rpc('get_dashboard_summary', { anchor_date: anchorDateStr }),
                supabase.rpc('get_dashboard_trends', { anchor_date: anchorDateStr })
            ]);

            if (summaryRes.error) {
                console.error("[API] get_dashboard_summary error:", summaryRes.error);
                throw summaryRes.error;
            }
            if (trendsRes.error) {
                console.error("[API] get_dashboard_trends error:", trendsRes.error);
                throw trendsRes.error;
            }
        })();
        
        this._summaryPromise = promise;
        return promise;
    },

            const summary = summaryRes.data;
            const trends = trendsRes.data || {};
            const sortedDaily = trends.daily || [];

            // 5. Construct Result
            const { metrics, stock, riskItems } = summary;

                const trends = {
                    daily: (trendsRes.daily || []).map((item: any) => ({
                        date: item.date,
                        quantity: item.quantity,
                        prevYearQuantity: item.prevYearQuantity,
                        prev2YearQuantity: item.prev2YearQuantity
                    })),
                    weekly: trendsRes.weekly || []
                };

                // Partial cache update
                this._dashboardCache = { ...(this._dashboardCache || {}), trends };
                return trends;
            } finally {
                this._trendsPromise = null;
            }
        })();

        this._trendsPromise = promise;
        return promise;
    },

    async _fetchDashboardCore(_isBackground: boolean) {
        const summary = await this.getDashboardSummary(true);
        const trends = await this.getDashboardTrends(true);
        return { ...summary, trends };
    },

    /**
     * Optimized fetcher for Keyword Ranking tab
     * Only fetches stats for products currently linked to keywords
     */
    async getProductStatsForKeywords(keywords: any[], historyDays: number = 20): Promise<{ stats: ProductStats[], anchorDate: string }> {
        const barcodesToFetch = Array.from(new Set(keywords.map(k => k.barcode).filter(b => !!b)));
        if (barcodesToFetch.length === 0) return { stats: [], anchorDate: new Date().toISOString().split('T')[0] };

        // 1. Fetch relevant products only
        const { data: products } = await supabase.from('products')
            .select('barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock, fc_stock, vf_stock, cost')
            .in('barcode', barcodesToFetch);
        
        if (!products || products.length === 0) return { stats: [], anchorDate: new Date().toISOString().split('T')[0] };
        const barcodes = products.map(p => p.barcode?.trim()).filter(b => !!b);

        // 2. Fetch recent sales for these barcodes only
        const anchorDateStr = await this._getLatestDateCore();
        
        const startD = new Date(anchorDateStr);
        startD.setDate(startD.getDate() - historyDays);
        const startDate = startD.toISOString().split('T')[0];

        // targeted fetch
        const { data: rawDailySales } = await supabase.from('daily_sales')
            .select('date, quantity, barcode, stock')
            .in('barcode', barcodes)
            .gte('date', startDate);

        // 3. Aggregate
        const rawDailyMap = new Map<string, { sales: Record<string, number>, stock: Record<string, number> }>();
        rawDailySales?.forEach((row: any) => {
            const b = row.barcode.trim();
            if (!rawDailyMap.has(b)) rawDailyMap.set(b, { sales: {}, stock: {} });
            const d = rawDailyMap.get(b)!;
            d.sales[row.date] = row.quantity;
            d.stock[row.date] = row.stock;
        });

        const result = products.map(p => {
            const b = p.barcode.trim();
            const rawD = rawDailyMap.get(b) || { sales: {}, stock: {} };
            const q7d = Object.entries(rawD.sales)
                .filter(([date]) => date > startDate) // simple sum for trends
                .reduce((sum, [_, qty]) => sum + Number(qty), 0);

            return {
                barcode: b,
                name: p.name,
                option: p.option_value,
                season: p.season || '정보없음',
                imageUrl: p.image_url,
                hqStock: Number(p.hq_stock || 0),
                coupangStock: Number(p.current_stock || 0),
                fcStock: Number(p.fc_stock || 0),
                vfStock: Number(p.vf_stock || 0),
                incomingStock: Number(p.incoming_stock || 0),
                safetyStock: Number(p.safety_stock || 10),
                totalSales: q7d, // Use recent sum for targeted stats
                fcSales: 0,
                vfSales: 0,
                sales14Days: q7d,
                sales7Days: q7d,
                salesYesterday: 0,
                sales30Days: q7d,
                salesWeekly: 0, 
                salesWeeklyPrev: 0,
                trends: { yesterday: 0, week: 0, month: 0 },
                avgDailySales: q7d / 7,
                daysOfInventory: 0,
                cost: Number(p.cost || 0),
                dailySales: rawD.sales,
                dailyStock: rawD.stock,
                abcGrade: 'D' as 'A' | 'B' | 'C' | 'D',
                prevSales7Days: 0,
                trend: 'flat' as const
            };
        });

        const res = { stats: result, anchorDate: anchorDateStr };
        // We'll skip caching the object for simplicity of the map types, 
        // given the targeted call is extremely fast anyway.
        return res;
    },

    async getCustomDailySalesTrend(startDate: string, endDate: string) {
        const fetchRange = async (s: string, e: string) => {
            let allData: any[] = [];
            let i = 0;
            const BATCH = 1000;
            let isDone = false;
            while (!isDone) {
                const { data, error } = await supabase.from('daily_sales')
                    .select('date, quantity')
                    .gte('date', s)
                    .lte('date', e)
                    .order('date', { ascending: true })
                    .order('barcode', { ascending: true })
                    .range(i, i + BATCH - 1);
                if (error) throw error;
                if (data && data.length > 0) allData.push(...data);
                if (!data || data.length < BATCH) isDone = true;
                i += BATCH;
            }
            return allData;
        };

        const currentData = await fetchRange(startDate, endDate);
        
        const m0 = new Map<string, number>();
        currentData.forEach(r => {
            const d = r.date.substring(0, 10);
            m0.set(d, (m0.get(d) || 0) + r.quantity);
        });

        // Use Date objects for iterating but avoid direct toISOString() for display mapping
        const sParts = startDate.split('-').map(Number);
        const eParts = endDate.split('-').map(Number);
        const sDateInput = new Date(sParts[0], sParts[1] - 1, sParts[2]);
        const eDateInput = new Date(eParts[0], eParts[1] - 1, eParts[2]);

        const fetchYearOffsetMap = async (offset: number) => {
            const s = new Date(sDateInput); s.setFullYear(s.getFullYear() - offset);
            const e = new Date(eDateInput); e.setFullYear(e.getFullYear() - offset);
            
            const sStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
            const eStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
            
            const data = await fetchRange(sStr, eStr);
            const m = new Map<string, number>();
            data.forEach(r => {
                const mmdd = r.date.substring(5, 10);
                m.set(mmdd, (m.get(mmdd) || 0) + r.quantity);
            });
            return m;
        };

        const m1 = await fetchYearOffsetMap(1);
        const m2 = await fetchYearOffsetMap(2);

        const result: any[] = [];
        const curr = new Date(sDateInput);
        while (curr <= eDateInput) {
            const y = curr.getFullYear();
            const m = curr.getMonth() + 1;
            const d = curr.getDate();
            const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const mmdd = dStr.substring(5, 10);
            
            result.push({
                date: dStr,
                fullDate: dStr,
                quantity: m0.get(dStr) || 0,
                prevYearQuantity: m1.get(mmdd) || 0,
                prev2YearQuantity: m2.get(mmdd) || 0
            });
            curr.setDate(curr.getDate() + 1);
        }
        
        return result;
    },

    /**
     * Fetch Product List with Sales & Inventory Data
     * Optionally takes the number of historical days to fetch (defaults to full year since Jan 1st if not specified)
     */
    async getProductStats(historyDays?: number): Promise<ProductStats[]> {
        // Cache management: We cache based on historyDays
        const cacheKey = historyDays ? `STATS_${historyDays}` : 'STATS_FULL';
        
        // Initialize _productStatsCache_Map if it doesn't exist
        if (!this._productStatsCache_Map) {
            this._productStatsCache_Map = new Map();
        }
        if (!this._productStatsPromise_Map) {
            this._productStatsPromise_Map = new Map();
        }

        if (this._productStatsCache_Map.has(cacheKey)) {
            console.log(`[Cache] ProductStats HIT for ${cacheKey}`);
            return this._productStatsCache_Map.get(cacheKey)!;
        }
        if (this._productStatsPromise_Map.has(cacheKey)) {
            console.log(`[Promise Cache] ProductStats HIT for ${cacheKey}`);
            return this._productStatsPromise_Map.get(cacheKey)!;
        }

        // Session storage cache for Instant Load
        try {
            const cachedStr = sessionStorage.getItem(cacheKey);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                if (Date.now() - parsed.timestamp < 5 * 60 * 1000) { // 5 mins
                    // CRITICAL: Skip cache if data is empty or malformed
                    if (!parsed.data || (Array.isArray(parsed.data) && parsed.data.length === 0)) {
                        console.log(`[Session Cache] Skipping EMPTY cache for ${cacheKey}`);
                    } else {
                        console.log(`[Session Cache] ProductStats HIT for ${cacheKey}`);
                        
                        // Background refresh
                        setTimeout(() => {
                            this._fetchProductStatsCore(historyDays, cacheKey, true);
                        }, 500);

                        return parsed.data;
                    }
                }
            }
        } catch(e) {
            console.warn("[Session Cache] Parse error, skipping...", e);
        }

        return this._fetchProductStatsCore(historyDays, cacheKey, false);
    },

    async _fetchProductStatsCore(historyDays: number | undefined, cacheKey: string, isBackground: boolean): Promise<ProductStats[]> {
        const promise = (async () => {
            if (!isBackground) console.time(`getProductStats(${historyDays || 'ALL'})`);

            const anchorDateStr = await this._getLatestDateCore();

            // 1. Call Optimized RPC (V16)
            const { data: stats, error } = await supabase.rpc('get_product_stats_v16', { anchor_date: anchorDateStr });
            
            if (error) {
                console.error("[API] get_product_stats_v16 error:", error);
                throw error;
            }

            const result: ProductStats[] = (stats || []).map((s: any) => ({
                barcode: s.barcode,
                name: s.name,
                option: s.option_value,
                season: s.season,
                imageUrl: s.image_url,
                hqStock: Number(s.hq_stock),
                coupangStock: Number(s.current_stock),
                fcStock: Number(s.fc_stock),
                vfStock: Number(s.vf_stock),
                incomingStock: Number(s.incoming_stock),
                safetyStock: 10,
                totalSales: Number(s.qty_year),
                fcSales: 0,
                vfSales: 0,
                sales14Days: Number(s.qty_14d),
                sales7Days: Number(s.qty_7d),
                salesYesterday: Number(s.qty_yesterday),
                avgDailySales: Number(s.avg_daily_sales),
                daysOfInventory: Number(s.avg_daily_sales) > 0 ? (Number(s.current_stock) / Number(s.avg_daily_sales)) : 0,
                cost: Number(s.cost),
                dailySales: s.daily_sales_json || {}, 
                dailyStock: {},
                abcGrade: s.abc_grade as 'A' | 'B' | 'C' | 'D',
                prevSales7Days: Number(s.qty_14d) - Number(s.qty_7d),
                trend: s.trend as any,
                sales30Days: Number(s.qty_30d),
                trends: {
                    yesterday: 0,
                    week: 0,
                    month: 0
                }
            }));

            this._productStatsCache_Map.set(cacheKey, result);
            if (!isBackground) console.timeEnd(`getProductStats(${historyDays || 'ALL'})`);
            return result;
        })();


        this._productStatsPromise_Map.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            this._productStatsPromise_Map.delete(cacheKey);
        }
    },

    /**
     * Get Supply Chain Analytics (Grouped by Week/Month + Upcoming Orders)
     */
    async getSupplyAnalytics(historyMonths: number = 24) {
        const { data, error } = await supabase.rpc('get_supply_analytics_v15', { history_months: historyMonths });
        if (error) {
            console.error("[API] get_supply_analytics_v15 error:", error);
            throw error;
        }
        return data as { timeline: any[], performance: any[], upcoming: any[] };
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
            .update({ current_stock: 0, hq_stock: 0, fc_stock: 0, vf_stock: 0 })
            .neq('barcode', 'RESET_ALL');

        if (updateError) throw updateError;

        return true;
    },

    /**
     * Send Out of Stock alert to Google Chat
     */
    async sendGoogleChatAlert(items: any[]) {
        const webhookUrl = import.meta.env.VITE_GOOGLE_CHAT_WEBHOOK_URL;
        if (!webhookUrl) throw new Error("Google Chat Webhook URL이 .env에 설정되지 않았습니다.");

        if (items.length === 0) return true;

        const dateStr = new Date().toLocaleDateString('ko-KR');

        // Group items by name
        const groups = new Map<string, any[]>();
        items.forEach(item => {
            if (!groups.has(item.name)) groups.set(item.name, []);
            groups.get(item.name)!.push(item);
        });

        const header = `🚨 * [긴급발주 요망] * ${dateStr} 기준 품절 임박 상품(${groups.size}종) \n--- \n`;

        let body = '';


        let index = 1;

        for (const [name, groupItems] of groups.entries()) {
            const grade = groupItems[0].abcGrade;
            // List options
            const optionsText = groupItems.map(i =>
                `   - ${i.option || i.season || i.barcode}: 쿠팡재고 ${i.coupangStock} 개(소진예상 약 ${i.daysOfInventory}일)`
            ).join('\n');

            body += `${index}. * ${name}* (등급: ${grade}) \n${optionsText} \n`;
            index++;
        }

        const message = {
            text: header + body + `\n-- -\n※ 빠른 시일 내에 물류센터(FC)로 재고 이관 혹은 제조 / 매입 발주를 권장합니다.`
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            throw new Error(`Google Chat 알림 전송 실패: ${response.statusText} `);
        }
        return true;
    },

    /**
     * Upload Coupang Order Data
     */
    async uploadCoupangOrders(orders: CoupangOrderRow[], onProgress?: (progress: number) => void) {
        if (orders.length === 0) return;

        // 1. Aggregate input data (sum within the current batch to handle duplicates in the file)
        const batchAggregated = orders.reduce((map, order) => {
            const key = `${order.date}_${order.barcode}_${order.center}`;
            const existing = map.get(key);
            if (existing) {
                existing.orderQty += order.orderQty;
                existing.confirmedQty += order.confirmedQty;
                existing.receivedQty += (order.receivedQty || 0);
                existing.unitCost = order.unitCost;
            } else {
                map.set(key, { ...order });
            }
            return map;
        }, new Map<string, CoupangOrderRow>());

        // 2. Prepare payload for upsert
        // We no longer fetch existing data from the DB to "add" it. 
        // Upsert will naturally replace rows with the same (order_date, barcode, center).
        const finalOrders = Array.from(batchAggregated.values()).map(order => ({
            order_date: order.date,
            barcode: order.barcode,
            center: order.center,
            order_qty: order.orderQty,
            confirmed_qty: order.confirmedQty,
            received_qty: order.receivedQty || 0,
            unit_cost: order.unitCost,
            created_at: new Date().toISOString()
        }));

        const CHUNK_SIZE = 500;
        const total = finalOrders.length;
        let processed = 0;
        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = finalOrders.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('coupang_orders')
                .upsert(chunk, { onConflict: 'order_date, barcode, center' });
            
            if (error) throw error;
            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }
    },

    async getIncomingOrders(limit = 3000) {
        // Fetch pending orders (confirmed >= 1, received = 0 or null)
        // Removing the backend date filter to ensure no formatting issues (e.g. dots vs dashes) skip data
        const { data, error } = await supabase
            .from('coupang_orders')
            .select('order_date, barcode, order_qty, confirmed_qty, received_qty, unit_cost, center')
            .or('received_qty.eq.0,received_qty.is.null')
            .gte('confirmed_qty', 1)
            .order('order_date', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getCoupangOrderStats(monthsLimit = 12) {
        const BATCH_SIZE = 1000;
        const startDateDate = new Date();
        startDateDate.setMonth(startDateDate.getMonth() - monthsLimit);
        const startDate = startDateDate.toISOString().split('T')[0];

        // 1. Get total count for parallel planning
        const { count, error: countError } = await supabase
            .from('coupang_orders')
            .select('*', { count: 'exact', head: true })
            .gte('order_date', startDate);

        if (countError) throw countError;
        const total = count || 0;

        // 2. Fetch in parallel batches
        const promises = [];
        for (let i = 0; i < total; i += BATCH_SIZE) {
            promises.push(
                supabase
                    .from('coupang_orders')
                    .select('order_date, barcode, order_qty, confirmed_qty, received_qty, unit_cost, center')
                    .gte('order_date', startDate)
                    .order('order_date', { ascending: false })
                    .range(i, i + BATCH_SIZE - 1)
            );
        }

        const results = await Promise.all(promises);
        const allData: any[] = [];
        results.forEach(res => {
            if (res.error) throw res.error;
            if (res.data) allData.push(...res.data);
        });

        return allData;
    },

    async getDashboardCombinedRankings(startDate: string, endDate: string): Promise<any[]> {
        const cacheKey = `RANKINGS_V4_${startDate}_${endDate}`;
        
        try {
            const cachedStr = sessionStorage.getItem(cacheKey);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                // Cache valid for 30 mins for rankings
                if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
                    console.log(`[Session Cache] Rankings HIT for ${cacheKey}`);
                    return parsed.data;
                }
            }
        } catch(e) {}

        const sD = new Date(startDate);
        const eD = new Date(endDate);
        
        // Calculate historical date ranges (Matching the SQL function params)
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        
        const s0 = formatDate(sD);
        const e0 = formatDate(eD);
        
        const sD1 = new Date(sD); sD1.setDate(sD1.getDate() - 364);
        const eD1 = new Date(eD); eD1.setDate(eD1.getDate() - 364);
        const s1 = formatDate(sD1);
        const e1 = formatDate(eD1);
        
        const sD2 = new Date(sD); sD2.setDate(sD2.getDate() - 728);
        const eD2 = new Date(eD); eD2.setDate(eD2.getDate() - 728);
        const s2 = formatDate(sD2);
        const e2 = formatDate(eD2);

        // Fetch using the NEW HIGH-SPEED optimized RPC for Top 100
        const { data, error } = await supabase.rpc('get_dashboard_rankings_fast', {
            start_0: s0,
            end_0: e0,
            start_1: s1,
            end_1: e1,
            start_2: s2,
            end_2: e2,
            limit_val: 100
        });

        if (error) {
            console.error("[API] get_dashboard_rankings_fast error:", error);
            throw error;
        }

        const result = data.map((r: any, index: number) => ({
            name: r.name,
            imageUrl: r.image_url,
            qty_0y: Number(r.qty_0y || 0),
            qty_1y: Number(r.qty_1y || 0),
            qty_2y: Number(r.qty_2y || 0),
            trend: Number(r.trend || 0),
            cost: Number(r.cost || 0),
            rank: index + 1
        }));

        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
        } catch(e) {}

        return result;
    },


    /**
     * Fetch Daily History for a single barcode (on-demand for charts)
     */
    async getProductHistory(barcode: string, days: number = 90): Promise<{ sales: Record<string, number>, stock: Record<string, number> }> {
        const endD = new Date();
        const startD = new Date();
        startD.setDate(startD.getDate() - days);
        
        const startDate = startD.toISOString().split('T')[0];
        const endDate = endD.toISOString().split('T')[0];

        const { data, error } = await supabase.from('daily_sales')
            .select('date, quantity, stock')
            .eq('barcode', barcode)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) {
            console.error(`[API] getProductHistory error for ${barcode}:`, error);
            throw error;
        }

        const sales: Record<string, number> = {};
        const stock: Record<string, number> = {};

        data?.forEach(row => {
            const dateStr = row.date.substring(0, 10);
            sales[dateStr] = row.quantity;
            stock[dateStr] = row.stock;
        });

        return { sales, stock };
    },

    /**
     * Advertising Management API (Proxy via Supabase Edge Function)
     */
    async _callAdProxy(method: string, path: string, params?: object, body?: object) {
        // Use direct fetch to avoid Supabase gateway's automatic Authorization header injection
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        
        // We need customerId for X-Requested-By header which is mandatory for Ad API
        // Typically it's passed in params or we can try to extract it
        const customerId = (params as any)?.customerId || (params as any)?.vendorId || '';

        const response = await fetch(`${supabaseUrl}/functions/v1/coupang-ad-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-By': customerId, // Pass to proxy
            },
            body: JSON.stringify({ method, path, params, body })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            console.warn(`[AdAPI] Proxy unavailable (${response.status}) at ${path}`);
            return { error: 'PROXY_UNAVAILABLE', status: response.status, message: errorText };
        }

        const data = await response.json();
        if (data.error) {
            console.error(`[AdAPI] Proxy logic error for ${path}:`, data.error);
            // If it's a known error from Coupang, we can handle it specifically if needed
        }
        return data;
    },

    async getAdSummary(customerId: string) {
        const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this._callAdProxy('GET', '/v2/providers/openapi/apis/api/v4/ad-service/reports/summary', { 
            customerId,
            startDate: today, 
            endDate: today, 
            reportType: 'SUMMARY' 
        });
    },

    async getAdProductReport(customerId: string) {
        const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this._callAdProxy('GET', '/v2/providers/openapi/apis/api/v4/ad-service/reports/products', { 
            customerId,
            startDate: today, 
            endDate: today, 
            reportType: 'PRODUCT' 
        });
    },

    async updateAdBid(adId: string, bid: number) {
        return this._callAdProxy('PATCH', `/v2/providers/openapi/apis/api/v4/ads/${adId}`, undefined, { bid });
    },

    async excludeAdKeyword(campaignId: string, keyword: string) {
        return this._callAdProxy('POST', `/v2/providers/openapi/apis/api/v4/campaigns/${campaignId}/excluded-keywords`, undefined, { keyword });
    },

    async getAdKeywordReport(customerId: string) {
        const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const endDate = kstNow.toISOString().split('T')[0];
        const last7Days = new Date(kstNow);
        last7Days.setDate(kstNow.getDate() - 7);
        const startDate = last7Days.toISOString().split('T')[0];
        
        return this._callAdProxy('GET', '/v2/providers/openapi/apis/api/v4/ad-service/reports/keywords', { 
            customerId,
            startDate, 
            endDate, 
            reportType: 'KEYWORD' 
        });
    },

    getCleanSeason(season: string | null | undefined): string {
        if (!season) return '기타';
        const s = season.trim();
        if (s === '봄/가을' || s === '봄가을' || s === '봄/ 가을') return '봄/가을';
        if (['겨울', '사계절', '여름', '봄', '가을'].includes(s)) {
            if (s === '봄' || s === '가을') return '봄/가을';
            return s;
        }
        return '기타';
    }
};

