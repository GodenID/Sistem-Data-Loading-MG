# Sistem Data Loading MG

Platform dokumentasi operasional untuk jasa perawatan tanaman — mencatat setiap **loading** dan **perawatan** ke perusahaan klien lengkap dengan foto, tim pelaksana, dan kode unik yang bisa dilacak. Dibangun untuk kerja lapangan: cepat di HP, tahan sinyal putus-nyambung, dan transparan ke klien lewat portal publik.

## Highlights

- **Kode unik per dokumentasi** — `LOAD-2026-0001`, `RWT-2026-0001`. Bisa dicari, disebut via telepon, dan anti-duplikat mutlak (satu perusahaan, satu jenis, satu tanggal).
- **Auth multi-user** — login username + password, role `admin` / `staff`, wajib ganti password saat pertama login, PIC otomatis terisi nama yang login.
- **Pelacakan per orang** — tiap dokumentasi mencatat tim pelaksana (hanya user berakun) + halaman Performa Tim: siapa loading berapa kali.
- **Portal klien** — share link publik per perusahaan (password + kedaluwarsa opsional), bisa dibuka tanpa login.
- **Galeri sentral** — puluhan ribu foto dalam satu arsip: filter perusahaan, jenis, tanggal, orang + infinite scroll.
- **Notifikasi Telegram** — tiap dokumentasi baru otomatis masuk grup internal.
- **Backup & restore** — backup JSON terjadwal ke S3 + restore mandiri.

## Arsitektur

```
Cloudflare Pages (frontend: Vite + React 19)
        │  REST/JSON + Bearer token
        ▼
Coolify VPS ── API (Node 20 + Express) ──► PostgreSQL 17
        │
        └─► S3-compatible storage (foto, video, backup JSON)
```

Database hanya menyimpan metadata + URL file. File fisik tidak pernah transit di API.

## Struktur Repo

```
├── server/                  # Backend API → deploy ke Coolify
│   ├── Dockerfile
│   ├── docker-compose.yaml  # (root) service API
│   └── src/
│       ├── index.js         # Entry point + aturan akses
│       ├── db.js            # Koneksi Postgres (DATABASE_URL)
│       ├── auth.js          # Session + guard role
│       ├── notify.js        # Notifikasi Telegram
│       ├── s3.js            # Helper URL storage
│       ├── schema.sql       # Schema konsolidasi (fresh install)
│       └── routes/          # companies, history, photos, team,
│                            #  shareLinks, stats, auth, media
├── src/                     # Frontend React
│   ├── pages/               # Home, Login, Admin*, ClientDetail,
│   │                        #  Gallery, TeamPage, Portal publik
│   ├── components/          # Modal, antrean upload, dsb.
│   └── utils/               # api.js, s3Config, shareLink, stats
├── database/                # Arsip migrasi era awal
├── COOLIFY.md               # Panduan migrasi data + deploy backend
└── DEPLOY.md                # Panduan deploy frontend (arsip)
```

## Menjalankan Lokal

```bash
# Backend
cd server
cp .env.example .env   # isi DATABASE_URL, CORS_ORIGIN
npm install
npm run dev            # :3001 — cek /health

# Frontend (terminal lain, dari root)
cp .env.example .env    # isi VITE_API_URL + kredensial S3
npm install
npm run dev
```

## Environment Variables

**Frontend** (`.env` lokal + Cloudflare Pages):

| Key | Contoh |
|-----|--------|
| `VITE_API_URL` | `https://api-domain-kamu.id` |
| `VITE_S3_ACCESS_KEY` | `****` |
| `VITE_S3_SECRET_KEY` | `****` |

Login memakai akun database (`users`), bukan env.

**Backend** (`server/.env` / Coolify):

| Key | Keterangan |
|-----|------------|
| `DATABASE_URL` | Koneksi Postgres |
| `PORT` | Default `3001` |
| `CORS_ORIGIN` | Domain frontend, pisahkan koma |
| `CREW_STATS_SINCE` | Skor tim dihitung mulai tanggal ini |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Notifikasi (kosongkan = mati) |
| `FRONTEND_URL` | Link di pesan Telegram |

## Aturan Akses API

| Aksi | Syarat |
|------|--------|
| Baca (GET) + portal klien | Publik |
| Tulis (POST/PATCH/PUT) | Wajib login |
| Hapus (DELETE) | Wajib `admin` |
| Kelola user | Wajib `admin` |
| Download media | Publik (file aslinya memang public-read) |

Akun admin pertama dibuat sekali via `POST /api/users/bootstrap` saat tabel masih kosong — setelah itu endpoint mati otomatis.

## Alur Kerja Tim

1. Staff login → nama otomatis terisi di kolom PIC + tim.
2. Upload foto → jalan di background, halaman tidak terkunci.
3. Duplikat tanggal otomatis ditolak dengan penjelasan data yang bentrok.
4. Grup Telegram menerima ringkasan tiap dokumentasi baru.
5. Admin pantau via dashboard, performa tim, dan galeri.

## Endpoint Ringkas

```
GET  /health
GET  /api/companies · POST · PATCH /:id · DELETE /:id
GET  /api/history (filter: perusahaan, tipe, tanggal, tim, kode)
POST /api/history (auto: kode unik, tim, notifikasi)
GET  /api/history/check-duplicate · /:id/crew · /:id/photos
GET  /api/photos/gallery (arsip paginasi + filter)
GET  /api/team · /api/team/stats · /api/team/:id/history
POST /api/auth/login|logout · GET /api/auth/me
GET|POST|PATCH|DELETE /api/users (admin)
GET  /api/media/download (proxy anti-CORS)
```

---
Created By **Goden** — Mutiari Garden, 2026
