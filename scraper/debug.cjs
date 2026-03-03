const puppeteer = require('puppeteer-extra');
(async () => {
    try {
        const b = await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            userDataDir: 'C:\\\\CoupangScraperProfile'
        });
        const p = await b.newPage();
        await p.goto('https://www.coupang.com/np/search?q=%EC%97%AC%EC%95%84%EC%B9%98%EB%A7%88', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 4000));

        const html = await p.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/vp/products/"]'));
            return links.slice(0, 5).map(a => {
                let el = a;
                let c = 0;
                while (el && c < 5) {
                    if (el.tagName === 'LI' || el.className.includes('product') || el.className.includes('item')) {
                        break;
                    }
                    el = el.parentElement;
                    c++;
                }
                if (!el) el = a;
                return el.outerHTML;
            }).join('\n\n=====\n\n');
        });
        console.log('Result:', html);
        await b.close();
    } catch (e) {
        console.error(e);
    }
})();
