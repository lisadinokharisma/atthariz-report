# ATTHARIZ Personal Brand Report Generator

Website generator laporan strategi personal brand bertenaga AI.  
Siapapun bisa isi form → dapat PDF report ala McKinsey dalam 60 detik.

---

## Cara Deploy ke Netlify (10 menit, gratis)

### Langkah 1: Upload file ke GitHub

1. Buka https://github.com → login atau daftar (gratis)
2. Klik **"New repository"**
3. Nama repo: `atthariz-report` → klik **Create repository**
4. Upload semua file berikut ke repo:
   - `index.html`
   - `netlify.toml`
   - `netlify/functions/generate.js`

   (Cara upload: di halaman repo, klik **"uploading an existing file"** → drag & drop semua file)

> ⚠️ Untuk file `generate.js`, pastikan struktur folder-nya benar:  
> `netlify/functions/generate.js` — bukan langsung di root

### Langkah 2: Deploy ke Netlify

1. Buka https://netlify.com → login dengan akun GitHub
2. Klik **"Add new site"** → **"Import an existing project"**
3. Pilih **GitHub** → pilih repo `atthariz-report`
4. Biarkan semua setting default → klik **"Deploy site"**
5. Tunggu 1–2 menit sampai status berubah jadi **"Published"**

### Langkah 3: Masukkan API Key (WAJIB)

1. Di dashboard Netlify, buka **Site configuration** → **Environment variables**
2. Klik **"Add a variable"**
3. Key: `ANTHROPIC_API_KEY`
4. Value: paste API key Anthropic-mu (format: `sk-ant-api...`)
5. Klik **Save**
6. Klik **Deploys** → **"Trigger deploy"** → **"Deploy site"** (agar key aktif)

### Langkah 4: Custom domain (opsional)

Di Netlify: **Domain management** → **Add custom domain**  
Contoh: `report.atthariz.com`

---

## Struktur File

```
atthariz-report/
├── index.html                    ← Website utama (wizard + report output)
├── netlify.toml                  ← Config Netlify
└── netlify/
    └── functions/
        └── generate.js           ← Proxy API (API key aman di sini)
```

---

## Cara Kerja

```
User isi form → browser POST ke /.netlify/functions/generate
                    ↓
            Netlify Function baca ANTHROPIC_API_KEY dari env
                    ↓
            Call Anthropic API (key tidak pernah ke browser)
                    ↓
            Return JSON → browser render report
                    ↓
                User print → PDF
```

---

## Estimasi Biaya API

- 1 report ≈ 1.500–2.500 token input + 1.500–2.000 token output
- Harga claude-sonnet-4-6: $3/1M input, $15/1M output
- **Estimasi per report: ~$0.04 (sekitar Rp 650)**
- Budget $10 = ±250 report

---

## Troubleshooting

| Masalah | Solusi |
|--------|--------|
| "API key tidak ditemukan" | Cek environment variable di Netlify, redeploy |
| Function timeout | Normal jika >10 detik — Netlify free plan limit 10s. Upgrade ke Netlify Pro atau kurangi max_tokens di generate.js |
| CORS error | Pastikan request ke `/.netlify/functions/generate` (bukan URL lain) |
| JSON parse error | AI kadang return format berbeda — sudah ada error handling, klik "Coba Lagi" |
