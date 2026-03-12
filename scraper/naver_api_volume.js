import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const NAVER_CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID || '';
const NAVER_ACCESS_LICENSE = process.env.NAVER_ACCESS_LICENSE || '';
const NAVER_SECRET_KEY = process.env.NAVER_SECRET_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[NaverAPI] 오류: Supabase 환경변수를 찾을 수 없습니다.');
    process.exit(1);
}

if (!NAVER_CUSTOMER_ID || !NAVER_ACCESS_LICENSE || !NAVER_SECRET_KEY) {
    console.error('[NaverAPI] 오류: 네이버 API 키(.env) 설정이 올바르지 않습니다.');
    console.log('필요한 환경 변수: NAVER_CUSTOMER_ID, NAVER_ACCESS_LICENSE, NAVER_SECRET_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BASE_URL = 'https://api.naver.com';

function generateSignature(timestamp, method, path) {
    const message = `${timestamp}.${method}.${path}`;
    const hmac = crypto.createHmac('sha256', NAVER_SECRET_KEY);
    hmac.update(message);
    return hmac.digest('base64');
}

async function fetchKeywordVolume(keywords) {
    const path = '/keywordstool';
    const method = 'GET';
    const timestamp = Date.now().toString();
    const signature = generateSignature(timestamp, method, path);

    const headers = {
        'X-Timestamp': timestamp,
        'X-API-KEY': NAVER_ACCESS_LICENSE,
        'X-Customer': NAVER_CUSTOMER_ID,
        'X-Signature': signature,
    };

    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.append('hintKeywords', keywords.join(','));
    url.searchParams.append('showDetail', '1');

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Naver API 오류: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.keywordList || [];
    } catch (error) {
        console.error('[NaverAPI] 키워드 조회 실패:', error.message);
        return null;
    }
}

async function syncNaverVolume() {
    console.log(`[NaverAPI] 네이버 키워드 조회 시작 - ${new Date().toLocaleString()}`);

    // Fetch tracking keywords from Supabase
    const { data: keywordsData, error } = await supabase.from('keywords').select('keyword');
    if (error) {
        console.error('[NaverAPI] DB 키워드 연동 실패', error);
        process.exit(1);
    }

    if (!keywordsData || keywordsData.length === 0) {
        console.log('[NaverAPI] 등록된 키워드가 없습니다.');
        process.exit(0);
    }

    // Deduplicate and filter keywords
    const uniqueKeywords = Array.from(new Set(keywordsData.map(k => k.keyword.replace(/\s+/g, ''))));
    console.log(`[NaverAPI] 총 ${uniqueKeywords.length}개의 키워드 데이터 조회를 시도합니다...`);

    const results = [];
    const getKSTDateString = () => {
        const d = new Date();
        const kstTime = d.getTime() + (9 * 60 * 60 * 1000);
        return new Date(kstTime).toISOString().split('T')[0];
    };
    const today = getKSTDateString();

    // Naver Keyword Tool API allows up to 5 hintKeywords per request
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
        const batch = uniqueKeywords.slice(i, i + BATCH_SIZE);
        console.log(`[NaverAPI] 조회 중 (${i + 1}/${uniqueKeywords.length}): ${batch.join(', ')}`);

        const apiResults = await fetchKeywordVolume(batch);

        if (apiResults) {
            // Keep exactly the requested ones in order, and map values
            for (const requestKw of batch) {
                // The API might return it with/without spaces, so we replace spaces for matching
                const matched = apiResults.find(r => r.relKeyword.replace(/\s+/g, '') === requestKw.replace(/\s+/g, ''));

                if (matched) {
                    // API returns monthly volumes (sometimes < 10 for very low volume). Parse as numbers.
                    const pcVolText = String(matched.monthlyPcQcCnt || 0);
                    const mobileVolText = String(matched.monthlyMobileQcCnt || 0);

                    const pc_volume = pcVolText.includes('< 10') ? 5 : parseInt(pcVolText.replace(/,/g, '')) || 0;
                    const mobile_volume = mobileVolText.includes('< 10') ? 5 : parseInt(mobileVolText.replace(/,/g, '')) || 0;

                    results.push({
                        keyword: requestKw, // Use original requested format (already stripped of spaces if preferred, or store what Supabase has)
                        pc_volume: pc_volume,
                        mobile_volume: mobile_volume,
                        total_volume: pc_volume + mobile_volume,
                        target_date: today,
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }

        // Sleep to avoid rate limits (ex: 10 requests per second allowed, but let's be safe)
        await new Promise(r => setTimeout(r, 200));
    }

    // Find the original keyword spelling before inserting to DB
    const finalResultsToInsert = results.map(item => {
        const originalKwObj = keywordsData.find(k => k.keyword.replace(/\s+/g, '') === item.keyword.replace(/\s+/g, ''));
        return {
            ...item,
            keyword: originalKwObj ? originalKwObj.keyword : item.keyword
        };
    });

    if (finalResultsToInsert.length > 0) {
        console.log(`[NaverAPI] ${finalResultsToInsert.length}개의 키워드 조회수 DB 업데이트 중...`);
        const { error: upsertError } = await supabase
            .from('keyword_search_volumes')
            .upsert(finalResultsToInsert, { onConflict: 'keyword, target_date' });

        if (upsertError) {
            console.error('[NaverAPI] DB 저장 실패:', upsertError);
        } else {
            console.log(`[NaverAPI] 완료! ${finalResultsToInsert.length}개의 데이터가 성공적으로 갱신되었습니다.`);
        }
    } else {
        console.log('[NaverAPI] 결과 항목이 없습니다. (조회량 0이거나 모든 요청 실패)');
    }

    process.exit(0);
}

syncNaverVolume().catch(err => {
    console.error('[NaverAPI] 예기치 않은 오류:', err);
    process.exit(1);
});
