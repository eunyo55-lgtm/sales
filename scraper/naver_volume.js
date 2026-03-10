import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[NaverScraper] 오류: Supabase 환경변수를 찾을 수 없습니다.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function scrapeNaverVolume() {
    console.log(`[NaverScraper] 네이버 조회수 수집 시작 - ${new Date().toLocaleString()}`);

    // 1. Fetch keywords from DB
    const { data: keywords, error } = await supabase.from('keywords').select('keyword');
    if (error) {
        console.error('[NaverScraper] DB 키워드 연동 실패', error);
        process.exit(1);
    }

    if (!keywords || keywords.length === 0) {
        console.log('[NaverScraper] 등록된 키워드가 없습니다.');
        process.exit(0);
    }

    const uniqueKeywords = Array.from(new Set(keywords.map(k => k.keyword)));
    console.log(`[NaverScraper] 총 ${uniqueKeywords.length}개의 키워드 조회수 수집 시도...`);

    // 2. Launch Browser
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        userDataDir: path.join(__dirname, '../temp/NaverScraperProfile'), // Separate profile for Naver
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-position=0,0'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null
    });

    const page = await browser.newPage();

    // Naver Keyword Tool URL - Updated to management console
    const NAVER_AD_URL = 'https://manage.searchad.naver.com/my-center/tool/keyword-planner';
    const NAVER_MAIN_URL = 'https://searchad.naver.com';

    console.log('[NaverScraper] 네이버 광고 시스템 접속 중...');
    try {
        await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.log('[NaverScraper] 직접 접속 실패, 메인 페이지로 이동합니다.');
        await page.goto(NAVER_MAIN_URL, { waitUntil: 'networkidle2' });
    }

    // Check if login is required
    let currentUrl = page.url();
    if (currentUrl.includes('nid.naver.com') || currentUrl.includes('searchad.naver.com')) {
        if (currentUrl.includes('nid.naver.com')) {
            console.log('[NaverScraper] 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요.');
        } else {
            console.log('[NaverScraper] 로그인 세션을 확인했습니다.');
        }

        // Wait for the user to be on ANY page that isn't the login page
        console.log('[NaverScraper] 로그인이 완료될 때까지 대기합니다...');
        await page.waitForFunction(() => {
            const href = window.location.href;
            return !href.includes('nid.naver.com') && (href.includes('searchad.naver.com') || href.includes('manage.searchad.naver.com'));
        }, { timeout: 0 });

        // Intermediate step: Brand Selection (My Center)
        if (page.url().includes('searchad.naver.com/my-center') || !page.url().includes('manage.searchad.naver.com')) {
            console.log('[NaverScraper] *** 중요: 브라우저 창에서 [관리할 브랜드(광고계정)]를 클릭해 주세요! ***');
            console.log('[NaverScraper] 실제 광고 관리 화면(manage.searchad.naver.com)에 진입하면 자동으로 수집을 재개합니다.');

            // Wait until the URL changes to manage.searchad.naver.com
            await page.waitForFunction(() => window.location.href.includes('manage.searchad.naver.com'), { timeout: 0 });
            console.log('[NaverScraper] 광고 관리 화면 진입이 확인되었습니다.');
            await new Promise(r => setTimeout(r, 2000)); // Give it a moment to load the GNB
        }

        // Once logged in and brand selected, force go to the keyword planner URL
        console.log('[NaverScraper] 키워드 도구 페이지로 이동 중...');
        try {
            await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (e) {
            console.log('[NaverScraper] 직접 이동이 지연되어 메뉴 클릭으로 시도합니다.');
        }
    }

    // Double check we are on the right page. If not, try to click the Tools menu.
    if (!page.url().includes('keyword-planner')) {
        console.log('[NaverScraper] 키워드 도구로 이동을 재시도합니다...');
        try {
            // Find "도구" menu using title attribute
            const toolMenuSelector = 'a[title="도구"]';
            await page.waitForSelector(toolMenuSelector, { timeout: 10000 });
            await page.click(toolMenuSelector);
            console.log('[NaverScraper] [도구] 메뉴를 클릭했습니다.');

            await new Promise(r => setTimeout(r, 1500));

            // Find "키워드 도구" sub-menu
            const plannerMenuSelector = 'a[title="키워드 도구"], a[href*="keyword-planner"]';
            await page.waitForSelector(plannerMenuSelector, { timeout: 5000 });
            await page.click(plannerMenuSelector);
            console.log('[NaverScraper] [키워드 도구] 메뉴를 클릭했습니다.');
        } catch (e) {
            console.log('[NaverScraper] 자동 메뉴 클릭 실패. 직접 [도구] -> [키워드 도구]를 클릭해 주세요.');
            await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
        }
    }

    // Wait for the user to reach the keyword planner page if still not there
    console.log('[NaverScraper] 키워드 도구 화면이 나타날 때까지 대기합니다...');
    try {
        await page.waitForFunction(() => window.location.href.includes('keyword-planner'), { timeout: 60000 });
    } catch (e) {
        console.log('[NaverScraper] 경고: 아직 키워드 도구 페이지가 아닙니다. 브라우저에서 직접 이동해 주세요.');
    }

    // Wait for the input field to appear
    console.log('[NaverScraper] 키워드 입력창 로드 대기 중...');
    const inputSelector = 'textarea.input_keyword';
    try {
        await page.waitForSelector(inputSelector, { timeout: 30000 });
        console.log('[NaverScraper] 입력창이 확인되었습니다.');
    } catch (e) {
        console.log('[NaverScraper] 입력창을 찾을 수 없습니다. 프레임 내부를 탐색합니다...');
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    // Helper function to find the correct frame
    const getTargetFrame = async () => {
        // In the modern management UI, it's usually on the main page
        const hasInputMain = await page.$(inputSelector);
        if (hasInputMain) return page;

        // Fallback for older interface/iframes
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const hasInput = await frame.$(inputSelector);
                if (hasInput) return frame;
            } catch (e) { }
        }
        return null;
    };

    // Naver Keyword Tool can process up to 5 keywords at once
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
        const batch = uniqueKeywords.slice(i, i + BATCH_SIZE);
        console.log(`[NaverScraper] 배치 처리 중 (${i + 1}/${uniqueKeywords.length}): ${batch.join(', ')}`);

        try {
            // Find the frame that contains our tool (with retries)
            let targetFrame = null;
            for (let retry = 0; retry < 5; retry++) {
                targetFrame = await getTargetFrame();
                if (targetFrame) break;
                console.log(`[NaverScraper] 입력창을 찾는 중... (${retry + 1}/5)`);
                await new Promise(r => setTimeout(r, 2500));
            }

            if (!targetFrame) {
                console.error('[NaverScraper] 오류: 키워드 입력창을 찾을 수 없습니다. 브라우저에서 직접 키워드 도구 화면을 열어주세요.');
                continue;
            }

            // Clear textarea and input keywords within the frame
            console.log('[NaverScraper] 키워드 입력 중...');
            await targetFrame.waitForSelector(inputSelector, { timeout: 10000 });
            await targetFrame.focus(inputSelector);

            // UI interaction to clear
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await targetFrame.type(inputSelector, batch.join('\n'));

            // Click search button within the frame
            console.log('[NaverScraper] 조회 버튼 클릭...');
            const searchBtnSelector = 'button.btn_search, .btn-search, button[type="submit"]';
            await targetFrame.click(searchBtnSelector);
            await new Promise(r => setTimeout(r, 4000)); // Wait for results

            // Extract data from the result table within the frame
            const data = await targetFrame.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table.tbl_keyword tbody tr'));
                return rows.map(row => {
                    const keyword = row.querySelector('td:nth-child(1)')?.textContent?.trim();
                    const pcVolume = row.querySelector('td:nth-child(2)')?.textContent?.trim().replace(/,/g, '').replace('< 10', '5');
                    const mobileVolume = row.querySelector('td:nth-child(3)')?.textContent?.trim().replace(/,/g, '').replace('< 10', '5');

                    if (!keyword) return null;

                    return {
                        keyword,
                        pc_volume: parseInt(pcVolume) || 0,
                        mobile_volume: parseInt(mobileVolume) || 0,
                        total_volume: (parseInt(pcVolume) || 0) + (parseInt(mobileVolume) || 0)
                    };
                }).filter(Boolean);
            });

            // Filter data to only include keywords from our current batch
            const batchResults = data.filter(item => batch.includes(item.keyword));

            batchResults.forEach(item => {
                results.push({
                    ...item,
                    target_date: today,
                    updated_at: new Date().toISOString()
                });
            });

        } catch (err) {
            console.error(`[NaverScraper] 배치 처리 오류:`, err.message);
        }
    }

    await browser.close();

    // 3. Save to DB
    if (results.length > 0) {
        console.log(`[NaverScraper] ${results.length}개의 데이터 DB 저장 중...`);
        const { error: upsertError } = await supabase
            .from('keyword_search_volumes')
            .upsert(results, { onConflict: 'keyword, target_date' });

        if (upsertError) {
            console.error('[NaverScraper] DB 저장 실패:', upsertError);
        } else {
            console.log('[NaverScraper] 수집 및 저장 완료!');
        }
    }

    process.exit(0);
}

scrapeNaverVolume().catch(err => {
    console.error('[NaverScraper] 예기치 않은 오류 발생:', err);
    process.exit(1);
});
