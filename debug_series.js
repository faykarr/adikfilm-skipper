const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://tv.adikfilm.bond/tv/a-knight-of-the-seven-kingdoms-2026/', { waitUntil: 'networkidle2' });

    // Klik reveal
    await page.evaluate(() => {
        document.querySelectorAll('.adikdown-btn').forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 2500));

    // Print struktur elemen dalam .adikdown
    const structure = await page.evaluate(() => {
        const container = document.querySelector('.adikdown');
        if (!container) return 'CONTAINER .adikdown NOT FOUND';
        const result = [];
        container.childNodes.forEach(node => {
            if (node.nodeType === 1) { // Element
                const tag = node.tagName;
                const cls = node.className;
                const text = node.innerText?.substring(0, 100).replace(/\n/g, ' ').trim();
                result.push(`<${tag} class="${cls}"> ${text}`);
            }
        });
        return result.join('\n');
    });

    console.log('=== STRUKTUR ELEMEN DALAM .adikdown ===');
    console.log(structure);
    console.log('\n=== FIRST 3000 CHARS of innerHTML ===');
    const innerHTML = await page.evaluate(() => document.querySelector('.adikdown')?.innerHTML?.substring(0, 3000) || 'NOT FOUND');
    console.log(innerHTML);

    await browser.close();
})();
