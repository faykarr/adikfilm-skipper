// ============================================================
// State
// ============================================================
let infoData = null; // Menyimpan data scrape dari /api/info

// ============================================================
// UI Elements
// ============================================================
const checkBtn    = document.getElementById('checkBtn');
const skipBtn     = document.getElementById('skipBtn');
const backBtn     = document.getElementById('backBtn');
const movieUrlInput = document.getElementById('movieUrl');
const step1       = document.getElementById('step-1');
const step2       = document.getElementById('step-2');
const statusDiv   = document.getElementById('status');
const resultDiv   = document.getElementById('result');
const statusText  = document.getElementById('statusText');
const movieTitle  = document.getElementById('movieTitle');
const epGroup     = document.getElementById('ep-group');
const epSelect    = document.getElementById('epSelect');
const resSelect   = document.getElementById('resSelect');
const finalUrlInput = document.getElementById('finalUrl');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn     = document.getElementById('copyBtn');

// ============================================================
// Step 1: Ambil Info Film
// ============================================================
checkBtn.addEventListener('click', async () => {
    const url = movieUrlInput.value.trim();
    if (!url) { alert('Masukkan URL film terlebih dahulu!'); return; }

    step1.classList.add('hidden');
    setStatus('Scraping info film... (bisa 10-20 detik)');

    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        infoData = json.data;
        movieTitle.innerText = infoData.title;

        if (infoData.isSeries) {
            // Series: tampilkan dropdown episode
            epGroup.classList.remove('hidden');
            const epLabels = Object.keys(infoData.episodes);
            epSelect.innerHTML = epLabels.map(ep => `<option value="${ep}">${ep}</option>`).join('');
            updateResDropdown();
            epSelect.onchange = updateResDropdown;
        } else {
            // Movie: tampilkan resolusi langsung
            epGroup.classList.add('hidden');
            resSelect.innerHTML = infoData.resolutions.map(r => `<option value="${r.label}">${r.label}</option>`).join('');
        }

        clearStatus();
        step2.classList.remove('hidden');
    } catch (e) {
        alert('Gagal: ' + e.message);
        step1.classList.remove('hidden');
        clearStatus();
    }
});

function updateResDropdown() {
    const selectedEp = epSelect.value;
    const resArr = infoData.episodes[selectedEp] || [];
    resSelect.innerHTML = resArr.map(r => `<option value="${r.label}">${r.label}</option>`).join('');
}

// ============================================================
// Step 2: Pilih Resolusi & Skip
// ============================================================
skipBtn.addEventListener('click', async () => {
    const resLabel = resSelect.value;

    // Temukan goUrl yang sesuai
    let anchors;
    if (infoData.isSeries) {
        const epData = infoData.episodes[epSelect.value] || [];
        const res = epData.find(r => r.label === resLabel);
        anchors = res?.anchors || [];
    } else {
        const res = infoData.resolutions.find(r => r.label === resLabel);
        anchors = res?.anchors || [];
    }

    // Prioritaskan GdFlix → Acefile → dll
    const PRIORITY = ['GdFlix', 'Acefile', 'Mega', 'TBox', 'Pixel'];
    let chosen = null;
    for (const p of PRIORITY) {
        chosen = anchors.find(a => a.text.toLowerCase().includes(p.toLowerCase()));
        if (chosen) break;
    }
    if (!chosen) chosen = anchors[0];

    if (!chosen) { alert('Link tidak ditemukan untuk pilihan ini.'); return; }

    step2.classList.add('hidden');
    resultDiv.classList.add('hidden');
    setStatus(`Bypass via ShrinkEarn → Token Decoder (provider: ${chosen.text})...`);

    try {
        const res = await fetch('/api/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goUrl: chosen.href })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        finalUrlInput.value = json.downloadUrl;
        downloadBtn.href = json.downloadUrl;
        clearStatus();
        resultDiv.classList.remove('hidden');
    } catch (e) {
        alert('Skip gagal: ' + e.message);
        step2.classList.remove('hidden');
        clearStatus();
    }
});

// ============================================================
// Helper: Status & Navigation
// ============================================================
function setStatus(msg) {
    statusText.innerText = msg;
    statusDiv.classList.remove('hidden');
}
function clearStatus() {
    statusDiv.classList.add('hidden');
}

const backToSelectionBtn = document.getElementById('backToSelectionBtn');
const backToUrlBtn     = document.getElementById('backToUrlBtn');

backBtn.addEventListener('click', () => {
    step2.classList.add('hidden');
    resultDiv.classList.add('hidden');
    step1.classList.remove('hidden');
    movieUrlInput.value = '';
    infoData = null;
});

// Kembali ke pemilihan resolusi/episode
backToSelectionBtn.addEventListener('click', () => {
    resultDiv.classList.add('hidden');
    step2.classList.remove('hidden');
});

// Kembali ke input URL baru
backToUrlBtn.addEventListener('click', () => {
    resultDiv.classList.add('hidden');
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
    movieUrlInput.value = '';
    infoData = null;
});

copyBtn.addEventListener('click', () => {
    finalUrlInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Tersalin!';
    setTimeout(() => copyBtn.innerText = 'Salin', 2000);
});
