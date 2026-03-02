const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function getGdflixLink(movieUrl) {
    let browser;
    try {
        console.log(`[1/4] Membuka browser untuk halaman film: ${movieUrl}`);
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(movieUrl, { waitUntil: 'networkidle2' });
        
        // Cari link go.adikfilm.link
        const goUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href*="go.adikfilm.link"]');
            return link ? link.href : null;
        });

        if (!goUrl) throw new Error('Link pengalihan tidak ditemukan di halaman ini.');

        const urlParams = new URL(goUrl).searchParams;
        const encodedUrl = urlParams.get('url');
        const origin = urlParams.get('origin') || 'adikfilm';

        console.log(`[2/4] Mengambil link shortlink dari API...`);
        // Kita bisa navigasi langsung ke go.adikfilm.link agar dapat cookiesnya
        await page.goto(`https://go.adikfilm.link/?url=${encodedUrl}&origin=${origin}`, { waitUntil: 'networkidle2' });
        
        // Panggil API link secara manual di context browser
        const shortlinkUrl = await page.evaluate(async (enc, ori) => {
            const res = await fetch(`/api/link?url=${encodeURIComponent(enc)}&origin=${ori}&provider=1`);
            const json = await res.json();
            return json.status === 200 ? json.data.url : null;
        }, encodedUrl, origin);

        if (!shortlinkUrl) throw new Error('Gagal mendapatkan link dari API go.adikfilm.link');

        console.log(`[3/4] Mengakses Health Shield: ${shortlinkUrl}`);
        await page.goto(shortlinkUrl, { waitUntil: 'networkidle2' });
        
        // Tunggu captcha atau elemen token muncul
        await page.waitForSelector('input[name="token"]', { timeout: 10000 });
        
        const token = await page.evaluate(() => {
            return document.querySelector('input[name="token"]').value;
        });

        if (!token) throw new Error('Token tidak ditemukan di halaman Health Shield.');

        console.log(`[4/4] Mendekode link GDFlix...`);
        // Cari bagian base64 yang merupakan URL (dimulai dengan aHR0cHM6 untuk https:)
        const base64Start = token.indexOf('aHR0cHM6');
        if (base64Start === -1) throw new Error('Format token tidak dikenal, link tidak ditemukan.');
        
        const base64Part = token.substring(base64Start);
        const finalLink = Buffer.from(base64Part, 'base64').toString('utf-8');

        if (!finalLink.startsWith('https://')) throw new Error('Gagal mendekode link GDFlix.');

        return finalLink;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// CLI Usage
const movieUrl = process.argv[2] || 'https://tv.adikfilm.bond/mercy-2026/';
getGdflixLink(movieUrl).then(link => {
    if (link) {
        console.log('\n====================================');
        console.log('BERHASIL! Link Download Anda:');
        console.log(link);
        console.log('====================================\n');
    } else {
        console.log('\nGagal mengambil link. Pastikan URL film benar.');
    }
});
