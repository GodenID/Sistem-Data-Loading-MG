-- ============================================
-- MG Report — Postgres schema untuk Coolify
-- Konsolidasi dari database/schema.sql + semua migration_*.sql
-- State akhir: TANPA projects_reports (di-drop), TANPA RLS
-- Cara pakai: psql $DATABASE_URL -f schema.sql (DB kosong saja)
-- Kalau migrasi dari Supabase: JANGAN run ini, pakai pg_dump restore.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- companies_reports ----------
CREATE TABLE IF NOT EXISTS companies_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    pic_name VARCHAR(255),
    contact VARCHAR(50),
    sales_name TEXT,
    logo_url TEXT,
    category TEXT,
    notes TEXT,
    tanaman_meja INTEGER DEFAULT 0,
    tanaman_lantai INTEGER DEFAULT 0,
    anggrek INTEGER DEFAULT 0,
    anggrek_bulan INTEGER DEFAULT 0,
    anggrek_dendro INTEGER DEFAULT 0,
    planter_box INTEGER DEFAULT 0,
    vertical_garden INTEGER DEFAULT 0,
    mini_garden INTEGER DEFAULT 0,
    center_piece INTEGER DEFAULT 0,
    pic_loading VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_reports_slug ON companies_reports(slug);
CREATE INDEX IF NOT EXISTS idx_companies_reports_name ON companies_reports(name);

-- ---------- loading_history_reports ----------
CREATE TABLE IF NOT EXISTS loading_history_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies_reports(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pic VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('loading', 'perawatan')),
    photo_count INTEGER DEFAULT 0,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_company_id ON loading_history_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_date ON loading_history_reports(date);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_type ON loading_history_reports(type);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_created_at ON loading_history_reports(created_at);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_loading_history_company_date_type') THEN
    ALTER TABLE loading_history_reports
      ADD CONSTRAINT uq_loading_history_company_date_type UNIQUE (company_id, date, type);
  END IF;
END $$;

-- ---------- photos_reports ----------
CREATE TABLE IF NOT EXISTS photos_reports (
    id SERIAL PRIMARY KEY,
    history_id INTEGER NOT NULL REFERENCES loading_history_reports(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size_bytes INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photos_reports_history_id ON photos_reports(history_id);
CREATE INDEX IF NOT EXISTS idx_photos_reports_sort_order ON photos_reports(sort_order);

-- ---------- share_links (per dokumentasi) ----------
CREATE TABLE IF NOT EXISTS share_links (
    id SERIAL PRIMARY KEY,
    history_id INTEGER NOT NULL REFERENCES loading_history_reports(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES companies_reports(id)
);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_history_id ON share_links(history_id);

-- ---------- company_share_links (portal client) ----------
CREATE TABLE IF NOT EXISTS company_share_links (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies_reports(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_company_share_links_token ON company_share_links(token);
CREATE INDEX IF NOT EXISTS idx_company_share_links_company_id ON company_share_links(company_id);

-- ---------- error_logs ----------
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    company_id INTEGER REFERENCES companies_reports(id),
    history_id INTEGER REFERENCES loading_history_reports(id),
    context JSONB,
    user_agent TEXT,
    ip_address INET,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);

-- ---------- upload_stats ----------
CREATE TABLE IF NOT EXISTS upload_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_uploads INTEGER DEFAULT 0,
    successful_uploads INTEGER DEFAULT 0,
    failed_uploads INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    avg_compression_ratio DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_upload_stats_date ON upload_stats(date);

-- ---------- users (login staff/admin) ----------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ---------- sessions (token login) ----------
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ---------- history_crew (tim per dokumentasi — user berakun) ----------
CREATE TABLE IF NOT EXISTS history_crew (
    history_id INTEGER NOT NULL REFERENCES loading_history_reports(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (history_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_history_crew_user_id ON history_crew(user_id);

-- ---------- triggers ----------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_companies_reports_updated_at ON companies_reports;
CREATE TRIGGER update_companies_reports_updated_at
    BEFORE UPDATE ON companies_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loading_history_reports_updated_at ON loading_history_reports;
CREATE TRIGGER update_loading_history_reports_updated_at
    BEFORE UPDATE ON loading_history_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- sequences aman setelah restore pg_dump (opsional, idempotent)
SELECT setval(pg_get_serial_sequence('companies_reports','id'), COALESCE(MAX(id),1)) FROM companies_reports;
SELECT setval(pg_get_serial_sequence('loading_history_reports','id'), COALESCE(MAX(id),1)) FROM loading_history_reports;
SELECT setval(pg_get_serial_sequence('photos_reports','id'), COALESCE(MAX(id),1)) FROM photos_reports;
