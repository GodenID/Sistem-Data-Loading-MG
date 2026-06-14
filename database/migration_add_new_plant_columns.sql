-- ============================================
-- Migration: Add New Columns to companies_reports
-- Adds anggrek_bulan, anggrek_dendro, planter_box, pic_loading
-- Updates company_share_links view
-- ============================================

-- 1. Add new columns (safe: only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'anggrek_bulan') THEN
        ALTER TABLE companies_reports ADD COLUMN anggrek_bulan INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'anggrek_dendro') THEN
        ALTER TABLE companies_reports ADD COLUMN anggrek_dendro INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'planter_box') THEN
        ALTER TABLE companies_reports ADD COLUMN planter_box INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'pic_loading') THEN
        ALTER TABLE companies_reports ADD COLUMN pic_loading VARCHAR(255) DEFAULT '';
    END IF;
END $$;

-- 2. Set NULLs to 0 / empty
UPDATE companies_reports 
SET 
    anggrek_bulan = COALESCE(anggrek_bulan, 0),
    anggrek_dendro = COALESCE(anggrek_dendro, 0),
    planter_box = COALESCE(planter_box, 0),
    pic_loading = COALESCE(pic_loading, '')
WHERE 
    anggrek_bulan IS NULL 
    OR anggrek_dendro IS NULL 
    OR planter_box IS NULL
    OR pic_loading IS NULL;

-- 3. Update company_share_links view to include new columns
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

SELECT 'Migration completed: New columns added and view updated!' as status;
