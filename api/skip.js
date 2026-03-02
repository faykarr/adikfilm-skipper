// api/skip.js — Vercel Serverless Function
// Bypass go.adikfilm.link → tpi.li token decoder

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

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
    return puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { goUrl } = req.body;
    if (!goUrl) return res.status(400).json({ success: false, error: 'goUrl diperlukan.' });

    let browser;
    try {
        const goUrlObj  = new URL(goUrl);
        const encodedUrl = goUrlObj.searchParams.get('url');
        const origin     = goUrlObj.searchParams.get('origin') || 'adikfilm';
        if (!encodedUrl) throw new Error('Parameter URL tidak ditemukan.');

        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Navigasi ke go.adikfilm.link dan panggil API internalnya
        await page.goto(goUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        const shortlinkUrl = await page.evaluate(async (enc, ori) => {
            const r = await fetch(`/api/link?url=${encodeURIComponent(enc)}&origin=${ori}&provider=1`);
            const j = await r.json();
            return j.status === 200 ? j.data.url : null;
        }, encodedUrl, origin);

        if (!shortlinkUrl) throw new Error('Gagal mendapatkan link ShrinkEarn.');

        // Ambil token dari tpi.li
        await page.goto(shortlinkUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await page.waitForSelector('input[name="token"]', { timeout: 8000 });
        const token = await page.evaluate(() => document.querySelector('input[name="token"]')?.value || '');

        if (!token) throw new Error('Token tidak ditemukan.');

        const b64Idx = token.indexOf('aHR0cHM6');
        if (b64Idx === -1) throw new Error('Pola Base64 tidak ditemukan.');

        const decoded = Buffer.from(token.substring(b64Idx), 'base64').toString('utf-8').split('\n')[0].trim();
        if (!decoded.startsWith('https://')) throw new Error('URL tidak valid: ' + decoded);

        res.json({ success: true, downloadUrl: decoded });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (browser) await browser.close();
    }
};
