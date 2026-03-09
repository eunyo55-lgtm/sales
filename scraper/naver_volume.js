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

    // Naver Keyword Tool URL
    const NAVER_AD_URL = 'https://searchad.naver.com/my-center/tool/keyword-planner';

    console.log('[NaverScraper] 네이버 광고 키워드 도구 접속 중...');
    await page.goto(NAVER_AD_URL, { waitUntil: 'networkidle2' });

    // Check if login is required
    const currentUrl = page.url();
    if (currentUrl.includes('nid.naver.com')) {
        console.log('[NaverScraper] 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요.');
        console.log('[NaverScraper] 로그인이 완료될 때까지 기다립니다...');
        await page.waitForFunction(() => window.location.href.includes('keyword-planner'), { timeout: 0 });
    }

    console.log('[NaverScraper] 키워드 도구 로드 완료.');

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    // Naver Keyword Tool can process up to 5 keywords at once
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
        const batch = uniqueKeywords.slice(i, i + BATCH_SIZE);
        console.log(`[NaverScraper] 배치 처리 중: ${batch.join(', ')}`);

        try {
            // Clear textarea and input keywords
            await page.waitForSelector('textarea.input_keyword');
            await page.click('textarea.input_keyword', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('textarea.input_keyword', batch.join('\n'));

            // Click search button
            await page.click('button.btn_search');
            await new Promise(r => setTimeout(r, 2000)); // Wait for results

            // Extract data from the result table
            const data = await page.evaluate(() => {
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
