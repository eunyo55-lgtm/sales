(globalThis as any).import = {
    meta: {
        env: {
            VITE_SUPABASE_URL: 'https://vzyfygmzqqiwgrcuydti.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'sb_publishable_gGEtueZfB9Knlci_vOSQcg_1sE7WXqh'
        }
    }
};

import { api } from './src/lib/api';

async function run() {
    console.log("Starting getDashboardAnalytics test...");
    console.time("getDashboardAnalytics");
    try {
        const result = await api.getDashboardAnalytics();
        console.timeEnd("getDashboardAnalytics");
        console.log("Dashboard analytics completed successfully. Items ranked:", result?.rankings?.yesterday?.length);
    } catch (e) {
        console.error("Dashboard error:", e);
    }

    console.log("\nStarting getProductStats test...");
    console.time("getProductStats");
    try {
        const result2 = await api.getProductStats();
        console.timeEnd("getProductStats");
        console.log("Product stats completed successfully. Products fetched:", result2?.length);
    } catch (e) {
        console.error("Product stats error:", e);
    }

    process.exit(0);
}

run();
