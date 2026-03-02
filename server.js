const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PROVIDER_PRIORITY = ['GdFlix', 'Acefile', 'Mega', 'TBox', 'Pixel'];

// Helper: prioritaskan provider
function pickProvider(anchors) {
    for (const p of PROVIDER_PRIORITY) {
        const found = anchors.find(a => a.text.toLowerCase().includes(p.toLowerCase()));
        if (found) return found;
    }
    return anchors[0] || null;
}

// Scrape info (judul, episode, resolusi)
async function scrapeInfo(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent(BROWSER_UA);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const isSeries = url.includes('/tv/');
        const title = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() || 'Unknown');

        // Klik tombol reveal download
        await page.evaluate(() => {
            const btns = document.querySelectorAll('.adikdown-btn, button');
            btns.forEach(b => { if (b.innerText.includes('Download') || b.innerText.includes('Link')) b.click(); });
        });
        await new Promise(r => setTimeout(r, 2500));

        const html = await page.content();
        const $ = cheerio.load(html);

        const result = { title, isSeries, episodes: {}, resolutions: [] };

        if (!isSeries) {
            // Movie: cari semua li item yang mengandung resolusi
            const resMap = {};
            $('li').each((_, li) => {
                const text = $(li).text().trim();
                const resMatch = text.match(/^(480p|720p|1080p(?:\s*x265)?)/i);
                if (!resMatch) return;
                const resLabel = resMatch[1].trim();
                const anchors = [];
                $(li).find('a[href*="go.adikfilm.link"]').each((_, a) => {
                    anchors.push({ text: $(a).text().trim(), href: $(a).attr('href') });
                });
                if (anchors.length > 0 && !resMap[resLabel]) {
                    resMap[resLabel] = anchors;
                }
            });
            result.resolutions = Object.keys(resMap).map(k => ({ label: k, anchors: resMap[k] }));
        } else {
            // Series: cek dulu apakah ada episode (div.adik-title) atau batch (langsung resolusi)
            const hasEpisodes = $('.adik-title').length > 0;

            if (!hasEpisodes) {
                // Series Batch — perlakukan seperti movie, langsung tampilkan resolusi
                result.isSeries = false; // Overwrite ke false agar UI tampil seperti movie
                const resMap = {};
                $('li').each((_, li) => {
                    const text = $(li).text().trim();
                    const resMatch = text.match(/^(\d{3,4}p(?:\s*x265)?)/i);
                    if (!resMatch) return;
                    const resLabel = resMatch[1].trim();
                    const anchors = [];
                    $(li).find('a[href*="go.adikfilm.link"]').each((_, a) => {
                        anchors.push({ text: $(a).text().trim(), href: $(a).attr('href') });
                    });
                    if (anchors.length > 0 && !resMap[resLabel]) {
                        resMap[resLabel] = anchors;
                    }
                });
                result.resolutions = Object.keys(resMap).map(k => ({ label: k, anchors: resMap[k] }));
            } else {
                // Series Episode — gunakan div.adik-title sebagai separator
                const episodeMap = {};

                $('.adik-title').each((_, titleEl) => {
                    const epLabel = $(titleEl).text().trim();
                    if (!epLabel) return;
                    const resMap = {};

                    // UL langsung setelah div.adik-title
                    const ul = $(titleEl).next('ul');
                    ul.find('li').each((_, li) => {
                        const liText = $(li).text().trim();
                        const resMatch = liText.match(/^(\d{3,4}p(?:\s*x265)?)/i);
                        if (!resMatch) return;
                        const resLabel = resMatch[1].trim();
                        const anchors = [];
                        $(li).find('a[href*="go.adikfilm.link"]').each((_, a) => {
                            anchors.push({ text: $(a).text().trim(), href: $(a).attr('href') });
                        });
                        if (anchors.length > 0 && !resMap[resLabel]) {
                            resMap[resLabel] = anchors;
                        }
                    });

                    if (Object.keys(resMap).length > 0) {
                        episodeMap[epLabel] = resMap;
                    }
                });

                for (const [ep, resMap] of Object.entries(episodeMap)) {
                    const resArr = Object.keys(resMap).map(k => ({ label: k, anchors: resMap[k] }));
                    if (resArr.length > 0) result.episodes[ep] = resArr;
                }
            }
        }


        return result;
    } finally {
        if (browser) await browser.close();
    }
}

// Bypass: dari link go.adikfilm.link ambil token di tpi.li
async function bypassGoLink(goUrl) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent(BROWSER_UA);
        await page.goto(goUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const urlParams = new URL(page.url()).searchParams;
        const encodedUrl = urlParams.get('url');
        const origin = urlParams.get('origin') || 'adikfilm';

        if (!encodedUrl) throw new Error('Parameter URL tidak ditemukan.');

        // Panggil API ShrinkEarn (provider=1)
        const shortlinkUrl = await page.evaluate(async (enc, ori) => {
            const res = await fetch(`/api/link?url=${encodeURIComponent(enc)}&origin=${ori}&provider=1`);
            const json = await res.json();
            return json.status === 200 ? json.data.url : null;
        }, encodedUrl, origin);

        if (!shortlinkUrl) throw new Error('Gagal mendapatkan link ShrinkEarn dari API.');

        // Buka tpi.li dan ambil token
        await page.goto(shortlinkUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await page.waitForSelector('input[name="token"]', { timeout: 10000 });
        const token = await page.evaluate(() => document.querySelector('input[name="token"]')?.value || '');

        if (!token) throw new Error('Token tidak ditemukan di Health Shield.');

        const b64Idx = token.indexOf('aHR0cHM6');
        if (b64Idx === -1) throw new Error('Pola link tidak ditemukan dalam token.');

        const decoded = Buffer.from(token.substring(b64Idx), 'base64').toString('utf-8');
        if (!decoded.startsWith('https://')) throw new Error('Hasil dekode bukan URL valid.');

        return decoded;
    } finally {
        if (browser) await browser.close();
    }
}

// API: GET INFO
app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL diperlukan.' });
    try {
        const info = await scrapeInfo(url);
        res.json({ success: true, data: info });
    } catch (e) {
        console.error(e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// API: SKIP LINK
app.post('/api/skip', async (req, res) => {
    const { goUrl } = req.body;
    if (!goUrl) return res.status(400).json({ success: false, error: 'goUrl diperlukan.' });
    try {
        const result = await bypassGoLink(goUrl);
        res.json({ success: true, downloadUrl: result });
    } catch (e) {
        console.error(e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(PORT, () => console.log(`\n🚀 Server running at http://localhost:${PORT}\n`));
