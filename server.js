// server.js — Local Development Server
// Menggunakan handler yang sama dengan Vercel /api/* functions

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const infoHandler = require('./api/info');
const skipHandler = require('./api/skip');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Adapter agar Express handler bisa memanggil Vercel-style handler
function vercelAdapter(handler) {
    return async (req, res) => {
        // Vercel handler expects req.body to already be parsed (Express does this)
        await handler(req, res);
    };
}

app.post('/api/info', vercelAdapter(infoHandler));
app.post('/api/skip', vercelAdapter(skipHandler));

app.listen(PORT, () => console.log(`\n🚀 Server running at http://localhost:${PORT}\n`));
