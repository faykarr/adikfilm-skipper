# 🎬 Adikfilm Skipper v2.0

> Bypass link download film & series dari Adikfilm secara instan — tanpa iklan, tanpa captcha.

[![Made by @faykarr](https://img.shields.io/badge/made%20by-%40faykarr-6366f1?style=flat-square&logo=github)](https://github.com/faykarr)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express)](https://expressjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## ✨ Fitur

- 🎬 **Movie** — Pilih resolusi (480p, 720p, 1080p, 4K, dst.)
- 📺 **Series (Per Episode)** — Pilih episode lalu resolusi
- 📦 **Series Batch** — Unduh semua episode sekaligus, pilih resolusi
- ⚡ **Token Decoder** — Reverse engineering token tpi.li / ShrinkEarn untuk melewati captcha & iklan secara instan
- 🤖 **Puppeteer Stealth** — Melewati proteksi Cloudflare secara otomatis
- 🎯 **Provider Priority** — Otomatis pilih GdFlix → Acefile → Mega → TBox → Pixel
- 🌐 **Web UI** — Antarmuka modern dengan step indicator dan dark mode

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js + Express.js |
| Web Scraping | Puppeteer + puppeteer-extra-plugin-stealth |
| HTML Parser | Cheerio |
| Frontend | Vanilla HTML/CSS/JS |

---

## 🚀 Cara Menjalankan Lokal

### Prerequisites
- Node.js v18 atau lebih baru
- npm

### Instalasi

```bash
# Clone repo
git clone https://github.com/faykarr/adikfilm-skipper.git
cd adikfilm-skipper

# Install dependencies
npm install

# Jalankan server
npm start
```

Buka browser dan akses: **http://localhost:3000**

---

## 📖 Cara Penggunaan

1. **Tempel URL** film atau series dari `tv.adikfilm.bond`
2. Klik **Check Info** — sistem akan scraping info film (10–20 detik)
3. **Pilih episode** (jika series) dan **resolusi** yang diinginkan
4. Klik **Bypass & Get Link** — sistem akan mendekode token secara otomatis
5. Link download langsung muncul — klik **Download Sekarang**!

### Contoh URL yang Didukung

```
# Movie
https://tv.adikfilm.bond/anaconda-2025/

# Series Per Episode
https://tv.adikfilm.bond/tv/a-knight-of-the-seven-kingdoms-2026/

# Series Batch
https://tv.adikfilm.bond/tv/wonder-man-2026/
```

---

## ⚙️ Cara Kerja (Teknis)

```
URL Film (tv.adikfilm.bond)
    │
    ▼ [Puppeteer Stealth]
Scrape daftar resolusi + links
    │
    ▼ [Pilih Provider: GdFlix/Acefile/dst]
go.adikfilm.link → /api/link?provider=1 (ShrinkEarn)
    │
    ▼
tpi.li (Health Shield) — ambil input[name="token"]
    │
    ▼ [Reverse Engineering]
Decode Base64 (mulai dari 'aHR0cHM6')
    │
    ▼
✅ Link Download Asli
```

---

## 🚨 Catatan Deploy

> [!WARNING]
> **Vercel tidak didukung** untuk proyek ini karena Puppeteer membutuhkan browser headless yang tidak dapat berjalan di lingkungan serverless Vercel.

### Platform yang Direkomendasikan

| Platform | Keterangan |
|---|---|
| **Railway** | ✅ Direkomendasikan — gratis tier tersedia, support Node.js penuh |
| **Render** | ✅ Gratis tier tersedia, mendukung long-running server |
| **VPS (DigitalOcean/Contabo)** | ✅ Full control |
| **Vercel** | ❌ Tidak kompatibel (tidak support Puppeteer) |

### Deploy ke Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login dan deploy
railway login
railway init
railway up
```

### Deploy ke Render

1. Push ke GitHub
2. Buat **New Web Service** di [render.com](https://render.com)
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Deploy!

---

## 📁 Struktur Proyek

```
adikfilm-skipper/
├── public/
│   ├── images/
│   │   └── cropped-iconku-1.png   # Logo
│   ├── index.html                  # Frontend UI
│   ├── script.js                   # Frontend Logic
│   └── style.css                   # Styling
├── server.js                       # Backend + API + Scraper
├── package.json
├── .gitignore
└── README.md
```

---

## 🔑 API Endpoints

### `POST /api/info`
Mengambil informasi film beserta daftar resolusi/episode.

**Request:**
```json
{ "url": "https://tv.adikfilm.bond/anaconda-2025/" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Anaconda (2025)",
    "isSeries": false,
    "resolutions": [
      { "label": "720p", "anchors": [{ "text": "GdFlix", "href": "https://go.adikfilm.link/..." }] }
    ],
    "episodes": {}
  }
}
```

### `POST /api/skip`
Melakukan bypass token untuk mendapatkan link download akhir.

**Request:**
```json
{ "goUrl": "https://go.adikfilm.link/?url=...&origin=adikfilm" }
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://gdflix.dev/file/xxxxx"
}
```

---

## 📝 License

MIT © 2026 [@faykarr](https://github.com/faykarr)
