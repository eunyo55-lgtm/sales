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
        userDataDir: 'C:\\NaverScraperProfile', // Separate profile for Naver
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
        await page.waitForFunction(() => !window.location.href.includes('nid.naver.com'), { timeout: 0 });

        // Once logged in, force go to the keyword planner URL
        console.log('[NaverScraper] 키워드 도구 페이지로 이동 중...');
        await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    }

    // Double check we are on the right page
    if (!page.url().includes('keyword-planner')) {
        console.log('[NaverScraper] 페이지 이동 재시도 중...');
        await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2' });
    }

    console.log('[NaverScraper] 키워드 도구 로드 대기 중...');

    // Wait for the main tool container/iframe to load
    try {
        await page.waitForSelector('iframe#container', { timeout: 30000 });
    } catch (e) {
        console.log('[NaverScraper] iframe#container를 찾을 수 없습니다. 일반 페이지로 진행합니다.');
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    // Helper function to find the correct frame
    const getTargetFrame = async () => {
        const frames = page.frames();
        for (const frame of frames) {
            const hasInput = await frame.$('textarea.input_keyword');
            if (hasInput) return frame;
        }
        return null;
    };

    // Naver Keyword Tool can process up to 5 keywords at once
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
        const batch = uniqueKeywords.slice(i, i + BATCH_SIZE);
        console.log(`[NaverScraper] 배치 처리 중: ${batch.join(', ')}`);

        try {
            // Find the frame that contains our tool
            let targetFrame = await getTargetFrame();

            if (!targetFrame) {
                console.log('[NaverScraper] 키워드 입력창을 찾는 중...');
                await new Promise(r => setTimeout(r, 3000));
                targetFrame = await getTargetFrame();
            }

            if (!targetFrame) {
                throw new Error('키워드 입력창(textarea.input_keyword)을 찾을 수 없습니다. 페이지가 아직 로딩 중이거나 주소가 잘못되었을 수 있습니다.');
            }

            // Clear textarea and input keywords within the frame
            await targetFrame.waitForSelector('textarea.input_keyword');
            await targetFrame.click('textarea.input_keyword', { clickCount: 3 });
            await targetFrame.focus('textarea.input_keyword');
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await targetFrame.type('textarea.input_keyword', batch.join('\n'));

            // Click search button within the frame
            await targetFrame.click('button.btn_search');
            await new Promise(r => setTimeout(r, 3000)); // Wait for results

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
