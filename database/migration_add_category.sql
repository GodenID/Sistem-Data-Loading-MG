-- ============================================
-- Migration: Add Category to Companies
-- Kategori: 'sewa_bulanan' atau 'project'
-- ============================================

ALTER TABLE companies_reports ADD COLUMN IF NOT EXISTS category TEXT;

DROP TABLE IF EXISTS projects_reports;

DROP INDEX IF EXISTS idx_projects_reports_company_id;
DROP INDEX IF EXISTS idx_projects_reports_start_date;
DROP INDEX IF EXISTS idx_projects_reports_end_date;

SELECT 'Migration completed: category column added, projects table dropped!' as status;
