import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';

chromium.use(stealthPlugin());

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
    let launchOptions = { headless: true };
    // GitHub actions usually has chrome installed, fallback to bundled chromium if not
    if (process.env.GITHUB_ACTIONS) {
        // Try to use bundled chromium on actions
    } else if (process.platform === 'win32') {
        launchOptions.channel = 'chrome'; // use local chrome on windows for better stealth
    }
    const browser = await chromium.launch(launchOptions);

    // Create an isolated context to ensure it's completely clean (incognito)
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        permissions: ['geolocation'],
        extraHTTPHeaders: {
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }
    });

    const page = await context.newPage();
    const today = new Date().toISOString().split('T')[0];

    // 3. Initial connection to the main page to clear Cloudflare/Akamai Bot Check and get cookies
    console.log('[Scraper] Connecting to main page to pass bot check...');
    try {
        await page.goto('https://www.coupang.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000 + Math.random() * 2000); // 3-5 seconds human wait
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1000 + Math.random() * 1000);
    } catch (e) {
        console.error('[Scraper] Failed to connect to main page:', e.message);
    }

    const results = [];

    // 4. Loop through keywords
    for (const kw of keywords) {
        console.log(`\n--- Tracking Keyword: "${kw.keyword}" ---`);
        let rankPosition = 0; // 0 means not found
        let found = false;
        let naturalCount = 0; // The actual rank count (excluding ads)

        for (let pageNum = 1; pageNum <= MAX_PAGES && !found; pageNum++) {
            console.log(`Searching Page ${pageNum}...`);
            const url = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(kw.keyword)}&channel=user&page=${pageNum}`;

            try {
                // Human-like navigation and scrolling
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(1500 + Math.random() * 2000); // Base wait 1.5s - 3.5s

                // Emulate human scrolling down the page
                for (let i = 0; i < 4; i++) {
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
                    await page.waitForTimeout(500 + Math.random() * 1500); // Wait between scrolls
                }

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
