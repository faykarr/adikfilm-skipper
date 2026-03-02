// api/info.js — Vercel Serverless Function
// Menggunakan @sparticuz/chromium + puppeteer-core (kompatibel Vercel)

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');

const isDev = process.env.NODE_ENV !== 'production';

const LOCAL_CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(p => { try { require('fs').accessSync(p); return true; } catch { return false; } });

async function getBrowser() {
    if (isDev) {
        return puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            executablePath: LOCAL_CHROME,
        });
    }
    // Di Vercel/production: gunakan sparticuz chromium
    return puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL diperlukan.' });

    let browser;
    try {
        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const title    = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() || 'Unknown');
        const isSeries = url.includes('/tv/');
        const html     = await page.content();
        const $        = cheerio.load(html);
        const hasEp    = $('.adik-title').length > 0;
        const result   = { title, isSeries: isSeries && hasEp, episodes: {}, resolutions: [] };

        if (!hasEp) {
            const resMap = {};
            $('li').each((_, li) => {
                const text = $(li).text().trim();
                const m = text.match(/^(\d{3,4}p(?:\s*x265)?)/i);
                if (!m) return;
                const label = m[1].trim();
                const anchors = [];
                $(li).find('a[href*="go.adikfilm.link"]').each((_, a) => {
                    anchors.push({ text: $(a).text().trim(), href: $(a).attr('href') });
                });
                if (anchors.length > 0 && !resMap[label]) resMap[label] = anchors;
            });
            result.resolutions = Object.keys(resMap).map(k => ({ label: k, anchors: resMap[k] }));
        } else {
            $('.adik-title').each((_, titleEl) => {
                const epLabel = $(titleEl).text().trim();
                if (!epLabel) return;
                const resMap = {};
                $(titleEl).next('ul').find('li').each((_, li) => {
                    const text = $(li).text().trim();
                    const m = text.match(/^(\d{3,4}p(?:\s*x265)?)/i);
                    if (!m) return;
                    const label = m[1].trim();
                    const anchors = [];
                    $(li).find('a[href*="go.adikfilm.link"]').each((_, a) => {
                        anchors.push({ text: $(a).text().trim(), href: $(a).attr('href') });
                    });
                    if (anchors.length > 0 && !resMap[label]) resMap[label] = anchors;
                });
                if (Object.keys(resMap).length > 0) {
                    result.episodes[epLabel] = Object.keys(resMap).map(k => ({ label: k, anchors: resMap[k] }));
                }
            });
        }

        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (browser) await browser.close();
    }
};
