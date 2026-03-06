import { api } from './src/lib/api.ts';

async function run() {
    try {
        console.log("Fetching dashboard analytics...");
        const result = await api.getDashboardAnalytics();
        if (result === null) {
            console.log("Result is NULL - No data in daily_sales");
        } else {
            console.log("Result acquired successfully, keys:", Object.keys(result));
        }
    } catch (err) {
        console.error("Error fetching dashboard analytics:", err);
    }
}

run();
