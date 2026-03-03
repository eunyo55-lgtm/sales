import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_PAGES = 5; // Look up to 5 pages

async function scrapeKeywords() {
    console.log(`[Scraper] Starting Coupang Keyword Ranking Scraper - ${new Date().toISOString()}`);

    // 1. Fetch keywords from DB
    const { data: keywords, error } = await supabase.from('keywords').select('*');
    if (error) {
        console.error('[Scraper] Failed to fetch keywords from Supabase', error);
        process.exit(1);
    }

    if (!keywords || keywords.length === 0) {
        console.log('[Scraper] No keywords to track. Exiting.');
        process.exit(0);
    }

    console.log(`[Scraper] Found ${keywords.length} keywords to track.`);

    // 2. Launch browser in Incognito mode
    // Using default context which is incognito in playwright when launched this way
    const browser = await chromium.launch({ headless: true });

    // Create an isolated context to ensure it's completely clean (incognito)
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    const today = new Date().toISOString().split('T')[0];

    const results = [];

    // 3. Loop through keywords
    for (const kw of keywords) {
        console.log(`\n--- Tracking Keyword: "${kw.keyword}" ---`);
        let rankPosition = 0; // 0 means not found
        let found = false;
        let naturalCount = 0; // The actual rank count (excluding ads)

        for (let pageNum = 1; pageNum <= MAX_PAGES && !found; pageNum++) {
            console.log(`Searching Page ${pageNum}...`);
            const url = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(kw.keyword)}&channel=user&page=${pageNum}`;

            try {
                // Coupang may block automated requests without proper headers/delay, wait a bit
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000 + Math.random() * 2000); // Random delay 2-4s to avoid blocking

                // Search for products
                const items = await page.$$('li.search-product');

                if (items.length === 0) {
                    console.log(`No products found on page ${pageNum}. Breaking.`);
                    break;
                }

                for (const item of items) {
                    // Check if it's an ad
                    // Coupang ads usually have a span with text '광고', class 'ad-badge' or 'ad-badge-text'
                    const isAd = await item.evaluate(el => {
                        const adBadge = el.querySelector('.ad-badge') || el.querySelector('.ad-badge-text');
                        // Alternatively check text content if classes change
                        const hasAdText = Array.from(el.querySelectorAll('span')).some(s => s.textContent?.trim() === '광고');
                        return !!adBadge || hasAdText;
                    });

                    if (isAd) {
                        // Skip ad, do not increment natural count
                        continue;
                    }

                    naturalCount++;

                    // Check if this product is our target product
                    const productIdAttr = await item.getAttribute('data-product-id');
                    const vendorItemIdAttr = await item.getAttribute('data-vendor-item-id');

                    if (productIdAttr === kw.coupang_product_id || vendorItemIdAttr === kw.coupang_product_id) {
                        rankPosition = naturalCount;
                        found = true;
                        console.log(`[SUCCESS] Found our product (ID: ${kw.coupang_product_id}) at Natural Rank: ${rankPosition} (Page: ${pageNum})`);
                        break;
                    }
                }
            } catch (err) {
                console.error(`Error searching page ${pageNum} for ${kw.keyword}:`, err);
                break;
            }
        }

        if (!found) {
            console.log(`[FAILED] Could not find the product within ${MAX_PAGES} pages.`);
        }

        results.push({
            keyword_id: kw.id,
            date: today,
            rank_position: rankPosition,
            updated_at: new Date().toISOString()
        });
    }

    await browser.close();

    // 4. Save to DB
    console.log('\n[Scraper] Saving results to Supabase...');
    if (results.length > 0) {
        const { error: upsertError } = await supabase
            .from('keyword_rankings')
            .upsert(results, { onConflict: 'keyword_id, date' });

        if (upsertError) {
            console.error('[Scraper] Failed to save results to DB', upsertError);
        } else {
            console.log(`[Scraper] Successfully saved ${results.length} records.`);
        }
    }

    console.log('[Scraper] Finished.');
}

scrapeKeywords().catch(err => {
    console.error('[Scraper] Unhandled Error:', err);
    process.exit(1);
});
