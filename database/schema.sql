-- ============================================
-- Mutiari Garden Report Database Schema
-- For Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: companies_reports
-- Store client/company information
-- ============================================
CREATE TABLE IF NOT EXISTS companies_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    pic_name VARCHAR(255),
    contact VARCHAR(50),
    -- Jumlah tanaman
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

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_reports_slug ON companies_reports(slug);
CREATE INDEX IF NOT EXISTS idx_companies_reports_name ON companies_reports(name);

-- ============================================
-- TABLE: loading_history_reports
-- Store loading and perawatan records
-- ============================================
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_company_id ON loading_history_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_date ON loading_history_reports(date);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_type ON loading_history_reports(type);
CREATE INDEX IF NOT EXISTS idx_loading_history_reports_created_at ON loading_history_reports(created_at);

-- ============================================
-- TABLE: photos_reports
-- Store photo URLs and metadata
-- ============================================
CREATE TABLE IF NOT EXISTS photos_reports (
    id SERIAL PRIMARY KEY,
    history_id INTEGER NOT NULL REFERENCES loading_history_reports(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size_bytes INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_photos_reports_history_id ON photos_reports(history_id);
CREATE INDEX IF NOT EXISTS idx_photos_reports_sort_order ON photos_reports(sort_order);

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_companies_reports_updated_at ON companies_reports;
CREATE TRIGGER update_companies_reports_updated_at
    BEFORE UPDATE ON companies_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loading_history_reports_updated_at ON loading_history_reports;
CREATE TRIGGER update_loading_history_reports_updated_at
    BEFORE UPDATE ON loading_history_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEW: loading_history_reports_with_company
-- For easier querying with company name
-- ============================================
CREATE OR REPLACE VIEW loading_history_reports_with_company AS
SELECT 
    lh.id,
    lh.company_id,
    c.name AS company_name,
    c.slug AS company_slug,
    lh.date,
    lh.pic,
    lh.type,
    lh.photo_count,
    lh.catatan,
    lh.created_at,
    lh.updated_at
FROM loading_history_reports lh
JOIN companies_reports c ON lh.company_id = c.id;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE loading_history_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_reports ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, can be restricted later)
CREATE POLICY "Allow all" ON companies_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON loading_history_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON photos_reports FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- COMPLETION
-- ============================================
SELECT 'Database setup completed successfully!' as status;
