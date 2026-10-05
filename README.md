# Sistem Data Loading MG 🌱

Aplikasi web dokumentasi **loading & perawatan tanaman** untuk Mutiari Garden — mencatat setiap pengiriman dan perawatan ke perusahaan klien lengkap dengan foto, bisa dibagikan ke klien lewat portal link, dan direkap lewat dashboard analitik.

Frontend berjalan di **Cloudflare Pages**, backend API + database di **Coolify VPS**, file foto/video tersimpan di **S3-compatible storage (Onidel Cloud)**.

## ✨ Fitur

- **Dokumentasi loading & perawatan** — upload banyak foto sekaligus, kompresi otomatis di browser, tersimpan rapi per tanggal per perusahaan
- **Manajemen klien** — data perusahaan, kontak, PIC, jumlah tanaman, logo, sales
- **Portal klien** — share link publik per perusahaan, opsional password & masa kedaluwarsa
- **Dashboard analitik** — ringkasan loading vs perawatan, heatmap aktivitas, top uploader, statistik upload
- **Riwayat & pencarian** — filter perusahaan, tipe, tanggal, pagination server-side
- **Backup & restore** — backup JSON otomatis ke S3, restore dari file
- **Export** — unduh Excel rekap + ZIP foto per dokumentasi
- **Offline-ready** — antrean upload background, tetap bisa lanjut saat koneksi putus
- **PWA** — bisa di-install, service worker dengan strategi network-first

## 🏗️ Arsitektur

```
Cloudflare Pages (frontend Vite + React)
        │  VITE_API_URL (REST/JSON)
        ▼
Coolify VPS ── server/ (Express + pg) ──► Postgres 17 (data)
        │
        │  (file tidak lewat sini)
        ▼
S3 Onidel Cloud (bucket `loading` — foto & backup)
```

> Database hanya menyimpan metadata + URL file. File fisik tidak pernah transit di API maupun database.

## 🧰 Tech Stack

| Lapisan  | Teknologi |
|----------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router 7, Chart.js |
| Backend  | Node.js 20, Express 4, `pg` (PostgreSQL driver) |
| Database | PostgreSQL 17 (di Coolify) |
| Storage  | S3-compatible — Onidel Cloud (`aws-sdk`) |
| Deploy   | Cloudflare Pages (frontend), Coolify (API + DB, via Dockerfile) |

## 📁 Struktur Repo

```
├── server/               # Backend API (Express + pg) → deploy ke Coolify
│   ├── Dockerfile
│   └── src/
│       ├── index.js      # Entry point, mounting routes
│       ├── db.js         # Koneksi Postgres (DATABASE_URL)
│       ├── schema.sql    # Schema konsolidasi untuk DB fresh
│       └── routes/       # companies, history, photos, shareLinks, stats
├── src/                  # Frontend React
│   ├── pages/            # Home, Admin*, ClientDetail, Public*, Portal
│   ├── components/       # Modal, dashboard, backup/restore, upload queue
│   └── utils/            # api.js (REST client), s3Config, shareLink, stats
├── database/             # Migrasi SQL lama (arsip era Supabase)
├── COOLIFY.md            # Panduan migrasi data + deploy (baca ini dulu)
├── DEPLOY.md             # Panduan deploy frontend (arsip Cloudflare)
└── README.md
```

## 🔐 Auth & User

Login username + password (tabel `users`, hash `bcrypt`, session token 30 hari):

| Role | Bisa apa |
|------|----------|
| `admin` | Semua: upload, edit, **hapus**, kelola user |
| `staff` | Upload + edit, **tidak bisa hapus** |

- Kolom PIC di form loading/perawatan otomatis terisi nama yang login.
- Tulis (POST/PATCH/PUT) wajib login, hapus (DELETE) wajib admin. Baca + portal klien tetap publik.
- Admin pertama: saat tabel `users` masih kosong, buat via:
  ```bash
  curl -X POST https://API-DOMAIN/api/users/bootstrap \
    -H 'Content-Type: application/json' \
    -d '{"username":"goden","password":"MIN_6_KARAKTER","name":"Goden"}'
  ```
- Kelola user di `/admin/users` (tambah, role, nonaktif, reset password, hapus).

## 🚀 Quickstart (lokal)

**1. Backend**

```bash
cd server
cp .env.example .env   # isi DATABASE_URL + CORS_ORIGIN
npm install
npm run dev            # http://localhost:3001, cek /health
```

**2. Frontend**

```bash
cp .env.example .env   # isi VITE_API_URL=http://localhost:3001 + kredensial S3
npm install
npm run dev
```

## 🔑 Environment Variables

Frontend (`.env`, juga di-set di Cloudflare Pages):

| Key | Contoh | Keterangan |
|-----|--------|------------|
| `VITE_API_URL` | `https://api-domain-kamu.id` | Base URL backend Coolify |
| `VITE_S3_ACCESS_KEY` | `****` | Akses S3 Onidel |
| `VITE_S3_SECRET_KEY` | `****` | Secret S3 Onidel |

Backend (`server/.env`, di-set di Coolify):

| Key | Contoh | Keterangan |
|-----|--------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/postgres` | Koneksi Postgres |
| `PORT` | `3001` | Port API |
| `CORS_ORIGIN` | `https://domain-frontend.pages.dev` | Domain frontend yang diizinkan (koma untuk banyak) |

## 🗄️ Migrasi Database

Pindahan dari Supabase self-hosted ke Postgres Coolify memakai `pg_dump` (data saja) — file di S3 tidak tersentuh. Langkah lengkap + verifikasi count ada di **[COOLIFY.md](COOLIFY.md)**.

## 📡 Ringkasan Endpoint API

```
GET  /health
GET  /api/companies[?search&page&limit]   GET /api/companies/count
GET  /api/companies/slug/:slug            POST /api/companies
PATCH /api/companies/:id                  DELETE /api/companies/:id
GET  /api/history[?filter&sort&page]      GET /api/history/summary|heatmap|stats
GET  /api/history/check-duplicate         POST|PATCH|DELETE /api/history...
GET  /api/history/:id/photos             PUT /api/history/:id/photos
POST /api/photos                          DELETE /api/photos/:id
POST|GET|PATCH|DELETE /api/company-share-links[...]   (+ /token/:token/access)
POST|GET|PATCH|DELETE /api/share-links[...]           (+ /token/:token/access)
GET  /api/upload-stats[?from&to]          POST /api/upload-stats/track
```

## 🤝 Kontribusi

Repo ini dipakai internal. Alur kerja: buat branch dari `main` → commit → pull request → review → merge → auto-deploy (Pages & Coolify).

---

Dibuat untuk operasional Mutiari Garden 🌿
