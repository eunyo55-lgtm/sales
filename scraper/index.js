import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';

puppeteer.use(stealthPlugin());

// Environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') }); // Load upper directory .env

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Scraper] 오류: Supabase 환경변수(.env)를 찾을 수 없습니다.');
    console.log('5초 뒤에 종료됩니다.');
    setTimeout(() => process.exit(1), 5000);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_PAGES = 2; // 최대 2페이지까지만 탐색

async function scrapeKeywords() {
    console.log(`[Scraper] 로컬 PC용 시각적 모드(Headed) 쿠팡 랭킹 추적 시작 - ${new Date().toLocaleString()}`);

    // 1. Fetch keywords from DB
    const { data: keywords, error } = await supabase.from('keywords').select('*');
    if (error) {
        console.error('[Scraper] DB 키워드 연동 실패', error);
        setTimeout(() => process.exit(1), 5000);
    }

    if (!keywords || keywords.length === 0) {
        console.log('[Scraper] 등록된 키워드가 없습니다. 종료합니다.');
        setTimeout(() => process.exit(0), 3000);
        return;
    }

    console.log(`[Scraper] 총 ${keywords.length}개의 키워드를 추적합니다.`);

    // 2. Launch Chrome directly with Puppeteer using a dedicated profile to bypass the profile picker and apply Stealth patches
    let browser;
    console.log('[Scraper] 크롬 브라우저를 보안 뚫기 모드로 엽니다...');
    try {
        browser = await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            userDataDir: 'C:\\CoupangScraperProfile',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-position=0,0',
                '--disable-infobars'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: null
        });
    } catch (e) {
        console.error('[Scraper] 크롬 브라우저 실행 실패:', e.message);
        setTimeout(() => process.exit(1), 5000);
        return;
    }

    const pages = await browser.pages();
    let page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Set extra headers to look like a normal user
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    // 3. 메인 접속으로 사람 인증(쿠키) 통과
    console.log('[Scraper] 쿠팡 메인 페이지 보안 확인 중...');
    try {
        await page.goto('https://www.coupang.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    } catch (e) { }

    // 4. 키워드별 순회
    for (const kw of keywords) {
        console.log(`\n--- [키워드: "${kw.keyword}"] ---`);
        let rankPosition = 0;
        let found = false;
        let naturalCount = 0;

        for (let pageNum = 1; pageNum <= MAX_PAGES && !found; pageNum++) {
            console.log(` ${pageNum}페이지 검색 중...`);
            const url = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(kw.keyword)}&channel=user&page=${pageNum}`;

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));

                // 스크롤 액션
                for (let i = 0; i < 3; i++) {
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
                    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
                }

                // 제품 리스트 가져오기 (기존 UI 및 새로운 React UI 대응)
                const items = await page.$$('li.search-product, li[class*="productUnit"], li[class*="ProductUnit"]');

                if (items.length === 0) {
                    console.log(`   └ 검색결과를 찾을 수 없습니다. (차단 혹은 비정상 페이지)`);
                    break; // 다음 키워드로 넘어감
                }

                for (const item of items) {
                    // 광고 여부 판별 (기존 및 신규 UI 대응)
                    const isAd = await page.evaluate(el => {
                        return !!(
                            el.querySelector('.ad-badge') ||
                            el.querySelector('.ad-badge-text') ||
                            el.querySelector('[class*="AdMark_adMark"]')
                        ) || Array.from(el.querySelectorAll('span, div')).some(s => {
                            const txt = s?.textContent?.trim();
                            return txt === '광고' || txt === 'AD';
                        });
                    }, item);

                    if (isAd) continue;

                    naturalCount++; // 순수 랭크 증가

                    // 상품 ID 추출 (href 우선 탐색, 없으면 기존 속성)
                    const { parsedProductId, parsedVendorItemId } = await page.evaluate(el => {
                        let pId = el.getAttribute('data-product-id');
                        let vId = el.getAttribute('data-vendor-item-id');

                        // 신규 UI: a 태그의 href에서 추출
                        const aTag = el.querySelector('a[href*="/vp/products/"]');
                        if (aTag) {
                            const href = aTag.getAttribute('href') || '';
                            const match = href.match(/\/vp\/products\/(\d+)/);
                            if (match) pId = match[1];

                            const urlParams = new URLSearchParams(href.split('?')[1] || '');
                            if (urlParams.has('vendorItemId')) vId = urlParams.get('vendorItemId');
                        }

                        return { parsedProductId: pId, parsedVendorItemId: vId };
                    }, item);

                    if (parsedProductId === kw.coupang_product_id || parsedVendorItemId === kw.coupang_product_id) {
                        rankPosition = naturalCount;
                        found = true;
                        console.log(`   ⭐ [성공!] 우리 상품 발견 - 자연 노출 순위: ${rankPosition}위 (Page ${pageNum})`);
                        break;
                    }
                }
            } catch (err) {
                console.error(`   └ 에러 발생:`, err.message);
                break;
            }
        }

        if (!found) {
            console.log(`   ❌ [실패] ${MAX_PAGES}페이지 이내에서 제품을 찾을 수 없습니다.`);
        }

        results.push({
            keyword_id: kw.id,
            date: today,
            rank_position: rankPosition,
            updated_at: new Date().toISOString()
        });
    }

    // Close the browser automatically after finishing
    await browser.close();

    // 5. DB 저장
    console.log('\n[Scraper] 데이터베이스에 저장 중...');
    if (results.length > 0) {
        const { error: upsertError } = await supabase
            .from('keyword_rankings')
            .upsert(results, { onConflict: 'keyword_id, date' });

        if (upsertError) {
            console.error('[Scraper] DB 저장 실패:', upsertError);
        } else {
            console.log(`[Scraper] 저장 완료! 총 ${results.length}개의 키워드 정보가 갱신되었습니다.`);
        }
    }

    console.log('[Scraper] 모든 작업을 마쳤습니다. 3초 뒤 창이 닫힙니다.');
    setTimeout(() => process.exit(0), 3000);
}

scrapeKeywords().catch(err => {
    console.error('[Scraper] 예기치 않은 오류 발생:', err);
    setTimeout(() => process.exit(1), 5000);
});
