# Deploy Tanpa Supabase — Coolify (Postgres + API) + Cloudflare (Frontend)

Arsitektur akhir:

- **Coolify VPS**: Postgres 16 (data) + `server/` (Express API) — pengganti Supabase
- **Cloudflare Pages**: frontend Vite (tetap)
- **S3 Onidel**: file foto/video — TIDAK PINDAH, tidak hilang

## 1. Buat database di Coolify

Coolify > New Resource > Database > PostgreSQL 16, catat `DATABASE_URL`.
Contoh internal: `postgresql://postgres:PASSWORD@postgres:5432/postgres`

## 2. Migrasi data dari Supabase self-hosted (file aman)

File di S3 tidak tersentuh — yang dipindah cuma baris DB (URL foto ikut aman).

```bash
# --- di VPS lama / di mana saja yang bisa akses Supabase lama ---
# Password postgres Supabase ada di file .env supabase (POSTGRES_PASSWORD)
docker exec supabase-db pg_dump -U postgres -d postgres \
  --no-owner --no-acl \
  -t companies_reports -t loading_history_reports -t photos_reports \
  -t share_links -t company_share_links -t error_logs -t upload_stats \
  > mg-data.sql

# --- restore ke Postgres Coolify ---
# via Coolify terminal service postgres, atau dari lokal:
psql "$DATABASE_URL_COOLIFY" -f mg-data.sql

# rapikan sequence (supaya insert baru tidak tabrakan id)
psql "$DATABASE_URL_COOLIFY" -c "
SELECT setval(pg_get_serial_sequence('companies_reports','id'), COALESCE(MAX(id),1)) FROM companies_reports;
SELECT setval(pg_get_serial_sequence('loading_history_reports','id'), COALESCE(MAX(id),1)) FROM loading_history_reports;
SELECT setval(pg_get_serial_sequence('photos_reports','id'), COALESCE(MAX(id),1)) FROM photos_reports;
SELECT setval(pg_get_serial_sequence('share_links','id'), COALESCE(MAX(id),1)) FROM share_links;
SELECT setval(pg_get_serial_sequence('company_share_links','id'), COALESCE(MAX(id),1)) FROM company_share_links;
"

# verify
psql "$DATABASE_URL_COOLIFY" -c "SELECT (SELECT COUNT(*) FROM companies_reports) AS companies, (SELECT COUNT(*) FROM loading_history_reports) AS history, (SELECT COUNT(*) FROM photos_reports) AS photos;"
```

> DB kosong / fresh install? Sebagai alternatif: `psql $DATABASE_URL -f server/src/schema.sql`

Rollback: jangan matikan Supabase lama sebelum H+2 stabil. Data lama tetap utuh.

## 3. Deploy API (`server/`) di Coolify

Coolify > New Resource > Application > pilih repo ini > ni:

- Build Pack: **Docker Compose** (file `docker-compose.yml` di root)
  (alternatif: Dockerfile dengan Dockerfile location `server/Dockerfile`)
- Ports Exposes: `3001`, health check path: `/health`
- Env:
  - `DATABASE_URL=postgresql://...` (dari langkah 1)
  - `CORS_ORIGIN=https://<frontend-pages>.pages.dev,https://report.domain-kamu.id`
- Domain: mis. `https://api-projectpg.prasastigroup.id`

Test: `curl https://api-.../health` → `{"ok":true,"db":"up"}`
Test data: `curl https://api-.../api/companies/count`

## 4. Arahkan frontend ke API baru

Set di Cloudflare Pages > Settings > Environment Variables:

- `VITE_API_URL=https://api-projectpg.prasastigroup.id`
- `VITE_S3_ACCESS_KEY`, `VITE_S3_SECRET_KEY` (sama seperti dulu)
- Login pakai akun database (tabel `users`), bukan password env lagi
- **Hapus** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (sudah tidak dipakai)

Lalu seperti biasa:

```bash
npm install
npm run build
npm run deploy
```

Lokal: copy `.env.example` ke `.env`, isi `VITE_API_URL=http://localhost:3001`,
jalankan `npm run dev` + `cd server && npm install && npm run dev`.

## 5. Checklist file tidak hilang

1. Bucket S3 tidak diubah sama sekali — tidak ada migrasi file.
2. Setelah restore, sampling 5–10 URL dari `photos_reports` dan buka di browser.
3. Upload 1 dokumentasi baru → cek file masuk ke folder S3 `loading/...` seperti biasa.
4. Backup JSON ( tombol Backup di app ) tetap jalan — isinya companies+history.

## Endpoint API (ringkas)

- `GET /health`
- `/api/companies` (GET list/search/page, GET /count, GET /active, GET /slug/:slug, POST, PATCH /:id, DELETE /:id)
- `/api/history` (GET list+filter, GET /summary, GET /heatmap, GET /stats, GET /check-duplicate, GET /top-uploaders, GET /hourly, POST, PATCH /:id, DELETE /:id, GET /:id/photos, PUT /:id/photos)
- `/api/photos` (POST single/bulk, DELETE /:id)
- `/api/company-share-links`, `/api/company-share-links/token/:token`, `.../access`
- `/api/share-links`, `/api/share-links/token/:token`, `.../access`
- `/api/upload-stats` (GET, GET /summary, POST /track, GET /error-rate, POST /errors, GET /errors/stats, GET /errors/recent, PATCH /errors/:id/resolve)
