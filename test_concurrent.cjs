const api = {
    _dashboardCache: null,
    _dashboardPromise: null,
    _productStatsCache: null,
    _productStatsPromise: null,
    _rawProductsPromise: null,
    _rawDailySalesPromise: null,

    async _fetchAllParallel(table) {
        console.log(`fetching ${table}...`);
        await new Promise(r => setTimeout(r, 100)); // simulate network
        return [{ id: 1, table }];
    },

    async _getRawProducts() {
        if (this._rawProductsPromise) return this._rawProductsPromise;
        const promise = this._fetchAllParallel('products');
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
        const promise = this._fetchAllParallel('daily_sales');
        this._rawDailySalesPromise = promise;
        try {
            return await promise;
        } catch (e) {
            this._rawDailySalesPromise = null;
            throw e;
        }
    },

    async getDashboardAnalytics() {
        if (this._dashboardCache) return this._dashboardCache;
        if (this._dashboardPromise) return this._dashboardPromise;

        const promise = (async () => {
            console.log("getDashboardAnalytics started");
            await new Promise(r => setTimeout(r, 50)); // simulate latestData query
            const sales = await this._getRawDailySales();
            const products = await this._getRawProducts();

            console.log("getDashboardAnalytics done", sales.length, products.length);
            const result = { type: 'dashboard', sales, products };
            this._dashboardCache = result;
            return result;
        })();

        this._dashboardPromise = promise;
        try {
            return await promise;
        } finally {
            this._dashboardPromise = null;
        }
    },

    async getProductStats() {
        if (this._productStatsCache) return this._productStatsCache;
        if (this._productStatsPromise) return this._productStatsPromise;

        const promise = (async () => {
            console.log("getProductStats started");
            const products = await this._getRawProducts();
            const sales = await this._getRawDailySales();

            console.log("getProductStats done", sales.length, products.length);
            const result = { type: 'product', sales, products };
            this._productStatsCache = result;
            return result;
        })();

        this._productStatsPromise = promise;
        try {
            return await promise;
        } finally {
            this._productStatsPromise = null;
        }
    }
};

async function test() {
    console.log("--- Mount ProductStatus ---");
    let p1 = api.getProductStats();

    console.log("--- Instantly Mount Dashboard (tab switch) ---");
    let p2 = api.getDashboardAnalytics();

    await Promise.all([p1, p2]);

    console.log("--- Second tab switch back to Dashboard ---");
    let p3 = await api.getDashboardAnalytics();
    console.log("p3 result:", p3 !== null);

    console.log("--- Second tab switch back to ProductStatus ---");
    let p4 = await api.getProductStats();
    console.log("p4 result:", p4 !== null);
}

test();
