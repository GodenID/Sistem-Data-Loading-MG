# Deploy ke Cloudflare Pages

Panduan lengkap deploy website Mutiari Garden Report ke Cloudflare Pages menggunakan Wrangler.

## Prerequisites

1. **Akun Cloudflare** - Daftar di https://dash.cloudflare.com
2. **Wrangler CLI** - Sudah terinstall via `npm install -D wrangler`
3. **Node.js** - Versi 18 atau lebih baru

## Setup Awal

### 1. Login ke Wrangler

```bash
npx wrangler login
```

Ini akan membuka browser untuk autentikasi dengan Cloudflare.

### 2. Build Project

```bash
npm run build
```

Pastikan folder `dist/` terbuat dengan benar.

### 3. Deploy Pertama Kali

```bash
npm run deploy
```

Atau deploy langsung ke production:

```bash
npm run deploy:prod
```

## Konfigurasi Environment Variables

Di Cloudflare Dashboard, tambahkan environment variables:

```
VITE_SUPABASE_URL=https://db-projectpg.prasastigroup.id
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
VITE_S3_ACCESS_KEY=NWD5S0ZT5DGZVJAL609Y
VITE_S3_SECRET_KEY=VedDZLSxwry4mPeX0Iv5LteYEYnG1Incmx5zVNyt
```

### Cara Tambah Environment Variables:

1. Buka Cloudflare Dashboard
2. Pilih Workers & Pages
3. Klik project "mutiari-garden-report"
4. Pilih tab Settings → Environment Variables
5. Tambahkan semua variables di atas
6. Save

## Deploy Update

Setelah ada perubahan kode:

```bash
# Build ulang
npm run build

# Deploy
npm run deploy
```

## Custom Domain (Opsional)

### 1. Tambah Custom Domain di Cloudflare:

1. Buka Cloudflare Dashboard → Pages
2. Pilih project "mutiari-garden-report"
3. Tab Custom Domains
4. Klik "Set up a custom domain"
5. Masukkan domain (contoh: `report.mutiari-garden.id`)
6. Ikuti instruksi DNS

### 2. Update DNS Records:

```
Type: CNAME
Name: report
Target: mutiari-garden-report.pages.dev
Proxy: ON (Orange cloud)
```

## Troubleshooting

### Error: "Failed to fetch"

Pastikan environment variables sudah di-set di Cloudflare Dashboard.

### Error: "Cannot find module"

Jalankan ulang:
```bash
npm install
npm run build
```

### SPA Routing Tidak Berfungsi

Pastikan file `_redirects` dan `_routes.json` ada di folder `public/`.

### Build Gagal

Cek Vite config:
```bash
npm run build
```

Periksa error message dengan teliti.

## Struktur Folder Build

```
dist/
├── index.html          # Entry point
├── logo.png           # Logo website
├── _redirects         # SPA redirect rules
├── _routes.json       # Cloudflare routes config
└── assets/            # Static assets
    ├── index-xxx.js
    ├── index-xxx.css
    └── ...
```

## Perintah Berguna

```bash
# Development
npm run dev

# Build untuk production
npm run build

# Preview build lokal
npm run preview

# Deploy ke Cloudflare Pages
npm run deploy

# Deploy dengan build otomatis
npm run deploy:prod

# Dev mode dengan Wrangler
npm run pages:dev
```

## Catatan Penting

1. **Environment Variables** harus di-set di Cloudflare Dashboard, bukan di `.env` file saja.
2. **Build** harus sukses sebelum deploy.
3. **Cache** browser mungkin perlu di-clear setelah deploy.
4. **HTTPS** otomatis aktif di Cloudflare Pages.

## Support

Jika ada masalah:
1. Cek Cloudflare Pages documentation: https://developers.cloudflare.com/pages/
2. Cek Wrangler documentation: https://developers.cloudflare.com/workers/wrangler/
3. Lihat log error dengan: `npx wrangler pages deploy dist --verbose`
