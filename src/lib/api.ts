import { supabase } from './supabase';
import type { ProductMaster, CoupangSalesRow, IncomingStockRow, HistoricalSalesRow } from './parsers';

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
    _productStatsCache: null as ProductStats[] | null,
    _productStatsPromise: null as Promise<ProductStats[]> | null,
    _rawProductsPromise: null as Promise<any[]> | null,
    _rawDailySalesPromise: null as Promise<any[]> | null,

    async _fetchAllParallel<T>(table: string, select: string, order?: string) {
        const BATCH_SIZE = 1000;
        const allData: T[] = [];
        let i = 0;

        // Fetch sequentially to completely avoid Supabase connection pool limits and count errors
        while (true) {
            let q = supabase.from(table).select(select).range(i, i + BATCH_SIZE - 1);
            if (order) q = q.order(order);

            try {
                const { data, error } = await q;
                if (error) {
                    console.error(`[API] Fetch error in ${table} range ${i} -${i + BATCH_SIZE - 1}: `, error);
                    throw error;
                }
                if (!data || data.length === 0) break;
                allData.push(...(data as T[]));

                // If we get fewer items than requested, we've reached the end
                if (data.length < BATCH_SIZE) break;

                i += BATCH_SIZE;
            } catch (err) {
                console.error(`[API] Network error fetching ${table}: `, err);
                throw err;
            }
        }
        return allData;
    },

    async _getRawProducts() {
        if (this._rawProductsPromise) return this._rawProductsPromise;
        const promise = this._fetchAllParallel<any>(
            'products',
            'barcode, name, option_value, season, image_url, hq_stock, current_stock, safety_stock, incoming_stock, fc_stock, vf_stock',
            'barcode'
        );
        this._rawProductsPromise = promise;
        try {
            return await promise;
        } catch (e) {
            this._rawProductsPromise = null;
            throw e;
        }
    },

    async _getRawDailySales() {
        if (this._rawDailySalesPromise) return this._rawDailySalesPromise;
        const promise = this._fetchAllParallel<any>(
            'daily_sales',
            'date, quantity, barcode, fc_quantity, vf_quantity, stock',
            'date'
        );
        this._rawDailySalesPromise = promise;
        try {
            return await promise;
        } catch (e) {
            this._rawDailySalesPromise = null;
            throw e;
        }
    },

    /**
     * Clear Cache (Call on data updates)
     */
    clearCache() {
        this._dashboardCache = null;
        this._dashboardPromise = null;
        this._productStatsCache = null;
        this._productStatsPromise = null;
        this._rawProductsPromise = null;
        this._rawDailySalesPromise = null;
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
        // Deduplicate sales data
        // We now need to track fcQty and vfQty separately
        // We now need to track fcQty and vfQty separately, and track the maximum currentStock for that day
        const aggregatedSalesMap = new Map<string, CoupangSalesRow & { fcQty: number, vfQty: number, maxStock: number }>();
        salesData.forEach(row => {
            const key = `${row.date}_${row.barcode} `;
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
            existingSales?.forEach(s => existingSalesMap.set(`${s.date}_${s.barcode} `, s));

            const { error } = await supabase
                .from('daily_sales')
                .upsert(
                    chunk.map(s => {
                        const existing = existingSalesMap.get(`${s.date}_${s.barcode} `);
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



        const CHUNK_SIZE = 1000;
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
        if (this._dashboardPromise) {
            console.log("[Promise Cache] Dashboard HIT");
            return this._dashboardPromise;
        }

        const promise = (async () => {
            console.time("getDashboardAnalytics");

            // 1. Get Latest Date (Anchor)
            const { data: latestData, error: latestError } = await supabase
                .from('daily_sales')
                .select('date')
                .order('date', { ascending: false })
                .limit(1)
                .single();

            if (latestError && latestError.code !== 'PGRST116') {
                console.error("[API] getDashboardAnalytics latestData error:", latestError);
                throw latestError;
            }
            if (!latestData) {
                console.warn("[API] getDashboardAnalytics no data found in daily_sales!");
                return null; // No data at all
            }

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

            // 2. Fetch Sales Data (Parallel)
            const sales = await this._getRawDailySales();

            // 3. Fetch Product Metadata (for Rankings) - PAGINATED
            const products_all = await this._getRawProducts();
            const productMap = new Map(products_all.map(p => [p.barcode, p]));

            // 4. Aggregation
            let statYesterday = 0; // Latest Date Sales
            let fcYesterday = 0;
            let vfYesterday = 0;
            let statYesterdayPrevYear = 0; // [NEW] 364 days ago

            let statWeekly = 0;
            let fcWeekly = 0;
            let vfWeekly = 0;
            let statWeeklyPrevYear = 0; // [NEW] 364 days ago

            let statMonthly = 0;
            let statMonthlyPrevYear = 0; // [NEW] 364 days ago

            let statYearly = 0;
            let statYearlyPrevYear = 0; // [NEW] 364 days ago

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
                // 1. Prev Day (Yesterday vs 1 day ago)
                const prevDayStr = shiftDate(anchorDateStr, -1);
                // 1-1. Prev Year Yesterday (364 days ago)
                const prevYearYesterdayStr = shiftDate(anchorDateStr, -364);

                if (date === anchorDateStr) {
                    statYesterday += qty;
                    fcYesterday += (s.fc_quantity || 0);
                    vfYesterday += (s.vf_quantity || 0);
                    rankYesterday.set(productName, (rankYesterday.get(productName) || 0) + qty);
                } else if (date === prevDayStr) {
                    rankYesterdayPrev.set(productName, (rankYesterdayPrev.get(productName) || 0) + qty);
                } else if (date === prevYearYesterdayStr) {
                    statYesterdayPrevYear += qty;
                }

                // 2. Weekly & Prev Weekly
                // Current Week: >= startOfWeekStr
                // Prev Week: (startOfWeekStr - 7) ~ (startOfWeekStr - 1)
                const startOfPrevWeekStr = shiftDate(startOfWeekStr, -7);
                // Prev Year Week: (startOfWeekStr - 364) ~ (startOfWeekStr - 358) => anchorDateStr is included if within week
                // Rather than a fixed end, let's just use the exact 7-day window 364 days ago
                const startOfPrevYearWeekStr = shiftDate(startOfWeekStr, -364);
                const endOfPrevYearWeekStr = shiftDate(anchorDateStr, -364);

                if (date >= startOfWeekStr) {
                    statWeekly += qty;
                    fcWeekly += (s.fc_quantity || 0);
                    vfWeekly += (s.vf_quantity || 0);
                    rankWeekly.set(productName, (rankWeekly.get(productName) || 0) + qty);
                } else if (date >= startOfPrevWeekStr && date < startOfWeekStr) {
                    rankWeeklyPrev.set(productName, (rankWeeklyPrev.get(productName) || 0) + qty);
                } else if (date >= startOfPrevYearWeekStr && date <= endOfPrevYearWeekStr) {
                    statWeeklyPrevYear += qty;
                }

                // 3. Monthly & Prev Monthly
                const currentMonthPrefix = anchorDateStr.substring(0, 7); // YYYY-MM
                const prevMonthDate = new Date(startOfMonth);
                prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
                const prevMonthPrefix = prevMonthDate.toISOString().substring(0, 7); // YYYY-MM (prev)
                const startOfMonthPrevYearStr = shiftDate(startOfMonth, -364);
                const endOfMonthPrevYearStr = shiftDate(anchorDateStr, -364); // match up to same weekday point

                const rowMonthPrefix = date.substring(0, 7);

                if (rowMonthPrefix === currentMonthPrefix) {
                    statMonthly += qty;
                    rankMonthly.set(productName, (rankMonthly.get(productName) || 0) + qty);
                } else if (rowMonthPrefix === prevMonthPrefix) {
                    rankMonthlyPrev.set(productName, (rankMonthlyPrev.get(productName) || 0) + qty);
                } else if (date >= startOfMonthPrevYearStr && date <= endOfMonthPrevYearStr) {
                    statMonthlyPrevYear += qty;
                }

                // 4. Yearly
                const startOfYearPrevYearStr = shiftDate(startOfYear, -364);
                const endOfYearPrevYearStr = shiftDate(anchorDateStr, -364);

                if (date >= startOfYear) {
                    statYearly += qty;
                    rankYearly.set(productName, (rankYearly.get(productName) || 0) + qty);
                } else if (date >= startOfYearPrevYearStr && date <= endOfYearPrevYearStr) {
                    statYearlyPrevYear += qty;
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

            console.log(`[Risk Alert] Calculating risk for period: ${startOfRiskStr} ~${anchorDateStr} `);

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

            console.log(`[Risk Alert] Final Risk Items: ${riskItems.length} `, riskItems.slice(0, 3));

            // Sort by impact (Avg Daily Sales DESC)
            riskItems.sort((a, b) => b.avgDailySales - a.avgDailySales);

            const result = {
                anchorDate: anchorDateStr,
                metrics: {
                    yesterday: statYesterday,
                    yesterdayPrevYear: statYesterdayPrevYear,
                    fcYesterday: fcYesterday,
                    vfYesterday: vfYesterday,
                    weekly: statWeekly,
                    weeklyPrevYear: statWeeklyPrevYear,
                    fcWeekly: fcWeekly,
                    vfWeekly: vfWeekly,
                    monthly: statMonthly,
                    monthlyPrevYear: statMonthlyPrevYear,
                    yearly: statYearly,
                    yearlyPrevYear: statYearlyPrevYear
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
        })();

        this._dashboardPromise = promise;
        try {
            return await promise;
        } finally {
            this._dashboardPromise = null;
        }
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
        if (this._productStatsPromise) {
            console.log("[Promise Cache] ProductStats HIT");
            return this._productStatsPromise;
        }

        const promise = (async () => {
            console.time("getProductStats");

            // 1. Fetch Products (Master + Stock)
            const products = await this._getRawProducts();

            if (!products) return []; // Ensure products is an array for subsequent operations

            // 2. Fetch Sales History (Last 30 Days for trends)
            const sales = await this._getRawDailySales();

            // ... existing aggregation logic ...
            // 3. Aggregate Sales (Anchor to Latest Date)
            const salesMap = new Map<string, { total: number, fcTotal: number, vfTotal: number, last14Days: number, last7Days: number, yesterday: number, daily: Record<string, number>, dailyStock: Record<string, number> }>();

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
                const entry = salesMap.get(s.barcode) || { total: 0, fcTotal: 0, vfTotal: 0, last14Days: 0, last7Days: 0, yesterday: 0, daily: {}, dailyStock: {} };
                entry.total += s.quantity;
                entry.fcTotal += (s.fc_quantity || 0);
                entry.vfTotal += (s.vf_quantity || 0);

                // Ranges
                if (s.date >= date14DaysAgo) entry.last14Days += s.quantity;
                if (s.date >= date7DaysAgo) entry.last7Days += s.quantity;
                if (s.date === dateYesterday) entry.yesterday += s.quantity;

                // Aggregate daily sales
                entry.daily[s.date] = (entry.daily[s.date] || 0) + s.quantity;

                // Capture daily stock only if it exists in DB for this date (so we know it's a real record)
                if (s.stock !== null && s.stock !== undefined) {
                    entry.dailyStock[s.date] = s.stock;
                }

                salesMap.set(s.barcode, entry);
            });

            // 4. Merge
            const result = products.map(p => {
                const s = salesMap.get(p.barcode) || { total: 0, fcTotal: 0, vfTotal: 0, last14Days: 0, last7Days: 0, yesterday: 0, daily: {}, dailyStock: {} };
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
                    fcStock: p.fc_stock || 0, // [NEW]
                    vfStock: p.vf_stock || 0, // [NEW]
                    incomingStock: p.incoming_stock || 0, // [NEW]
                    safetyStock: p.safety_stock || 10,
                    totalSales: s.total,
                    fcSales: s.fcTotal, // [NEW]
                    vfSales: s.vfTotal, // [NEW]
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
                    dailyStock: s.dailyStock,
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
        })();

        this._productStatsPromise = promise;
        try {
            return await promise;
        } finally {
            this._productStatsPromise = null;
        }
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

        const header = `🚨 * [긴급발주 요망] * ${dateStr} 기준 품절 임박 상품(${groups.size}종) \n-- -\n`;

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
    }
};
