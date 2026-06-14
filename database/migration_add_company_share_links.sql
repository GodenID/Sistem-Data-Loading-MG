-- ============================================
-- Migration: Add Company Share Links
-- For client portal access
-- ============================================

-- ============================================
-- TABLE: company_share_links
-- Store public share links for company/client portal
-- ============================================
CREATE TABLE IF NOT EXISTS company_share_links (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies_reports(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL means no password protection
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expire
    is_active BOOLEAN DEFAULT TRUE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER -- track who created
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_share_links_token ON company_share_links(token);
CREATE INDEX IF NOT EXISTS idx_company_share_links_company_id ON company_share_links(company_id);
CREATE INDEX IF NOT EXISTS idx_company_share_links_expires_at ON company_share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_company_share_links_is_active ON company_share_links(is_active);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE company_share_links ENABLE ROW LEVEL SECURITY;

-- Policies for company_share_links
DROP POLICY IF EXISTS "Allow all read" ON company_share_links;
CREATE POLICY "Allow all read" ON company_share_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all insert" ON company_share_links;
CREATE POLICY "Allow all insert" ON company_share_links FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all update" ON company_share_links;
CREATE POLICY "Allow all update" ON company_share_links FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow all delete" ON company_share_links;
CREATE POLICY "Allow all delete" ON company_share_links FOR DELETE USING (true);

-- ============================================
-- VIEW: company_share_links_with_company
-- For easier querying
-- ============================================
DROP VIEW IF EXISTS company_share_links_with_company;
CREATE VIEW company_share_links_with_company AS
SELECT 
    csl.*,
    c.name as company_name,
    c.slug as company_slug,
    c.address as company_address,
    c.pic_name,
    c.contact,
    c.tanaman_meja,
    c.tanaman_lantai,
    c.anggrek,
    c.vertical_garden,
    c.mini_garden,
    c.center_piece,
    c.anggrek_bulan,
    c.anggrek_dendro,
    c.planter_box,
    c.pic_loading
FROM company_share_links csl
JOIN companies_reports c ON csl.company_id = c.id;

-- ============================================
-- FUNCTION: Increment company share link access count
-- ============================================
CREATE OR REPLACE FUNCTION increment_company_share_link_access(link_token VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE company_share_links 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE token = link_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETION
-- ============================================
SELECT 'Migration completed: Company share links table created!' as status;
