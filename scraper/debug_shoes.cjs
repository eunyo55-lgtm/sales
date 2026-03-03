const puppeteer = require('puppeteer-extra');
(async () => {
    try {
        const b = await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            userDataDir: 'C:\\CoupangScraperProfile'
        });
        const p = await b.newPage();
        await p.goto('https://www.coupang.com/np/search?q=%EC%9C%A0%EC%B9%98%EC%9B%90%EC%8B%A4%EB%82%B4%ED%99%94', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 4000));

        const products = await p.evaluate(() => {
            const items = Array.from(document.querySelectorAll('li.search-product, li[class*="productUnit"], li[class*="ProductUnit"]'));
            return items.slice(0, 15).map(el => {
                const isAd = !!(
                    el.querySelector('.ad-badge') ||
                    el.querySelector('.ad-badge-text') ||
                    el.querySelector('[class*="AdMark_adMark"]')
                ) || Array.from(el.querySelectorAll('span, div')).some(s => {
                    const txt = s?.textContent?.trim();
                    return txt === '광고' || txt === 'AD';
                });

                let pId = el.getAttribute('data-product-id');
                let vId = el.getAttribute('data-vendor-item-id');

                const aTag = el.querySelector('a[href*="/vp/products/"]');
                if (aTag) {
                    const href = aTag.getAttribute('href') || '';
                    const match = href.match(/\/vp\/products\/(\d+)/);
                    if (match) pId = match[1];
                    const urlParams = new URLSearchParams(href.split('?')[1] || '');
                    if (urlParams.has('vendorItemId')) vId = urlParams.get('vendorItemId');
                }

                // Try to get title
                let title = '';
                const nameEl = el.querySelector('.name, [class*="productName"]');
                if (nameEl) title = nameEl.textContent?.trim();

                return { title, isAd, pId, vId };
            });
        });
        console.log('Result:', products);
        await p.screenshot({ path: 'debug_shoes.png' });
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();
