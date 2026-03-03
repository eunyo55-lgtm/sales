import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const SCRAPER_API_KEY = process.env.VITE_SCRAPER_API_KEY || ''; // New ScraperAPI Key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_PAGES = 5; // Look up to 5 pages

async function scrapeKeywords() {
    console.log(`[Scraper] Starting Coupang Keyword Ranking Scraper with ScraperAPI - ${new Date().toISOString()}`);

    if (!SCRAPER_API_KEY) {
        console.error('[Scraper] ERROR: ScraperAPI Key is missing!');
        console.error('[Scraper] Please add VITE_SCRAPER_API_KEY to your GitHub Secrets and local .env file.');
        process.exit(1);
    }

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

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    // 2. Loop through keywords
    for (const kw of keywords) {
        console.log(`\n--- Tracking Keyword: "${kw.keyword}" ---`);
        let rankPosition = 0; // 0 means not found
        let found = false;
        let naturalCount = 0; // The actual rank count (excluding ads)

        for (let pageNum = 1; pageNum <= MAX_PAGES && !found; pageNum++) {
            console.log(`Searching Page ${pageNum}...`);
            const targetUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(kw.keyword)}&channel=user&page=${pageNum}`;

            // Build ScraperAPI request URL
            const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&country_code=kr`;

            try {
                // Fetch the HTML via ScraperAPI
                const response = await axios.get(scraperApiUrl, { timeout: 60000 });
                const html = response.data;
                const $ = cheerio.load(html);

                // Search for products
                const items = $('li.search-product');

                if (items.length === 0) {
                    console.log(`No products found on page ${pageNum}. Breaking.`);
                    break;
                }

                items.each((i, el) => {
                    if (found) return; // already found, break each loop

                    const $el = $(el);

                    // Check if it's an ad
                    const hasAdBadge = $el.find('.ad-badge, .ad-badge-text').length > 0;
                    let hasAdText = false;
                    $el.find('span').each((_, spanEl) => {
                        if ($(spanEl).text().trim() === '광고') {
                            hasAdText = true;
                        }
                    });

                    if (hasAdBadge || hasAdText) {
                        return; // Skip ad
                    }

                    naturalCount++;

                    // Check if this product is our target product
                    const productIdAttr = $el.attr('data-product-id');
                    const vendorItemIdAttr = $el.attr('data-vendor-item-id');

                    if (productIdAttr === kw.coupang_product_id || vendorItemIdAttr === kw.coupang_product_id) {
                        rankPosition = naturalCount;
                        found = true;
                        console.log(`[SUCCESS] Found our product (ID: ${kw.coupang_product_id}) at Natural Rank: ${rankPosition} (Page: ${pageNum})`);
                    }
                });

            } catch (err) {
                console.error(`Error searching page ${pageNum} for ${kw.keyword}:`, err.message || err);
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

    // 3. Save to DB
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
