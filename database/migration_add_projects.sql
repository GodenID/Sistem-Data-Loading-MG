-- ============================================
-- Migration: Add Projects Table
-- Untuk tracking sewa/client project
-- ============================================

CREATE TABLE IF NOT EXISTS projects_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies_reports(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_reports_company_id ON projects_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_reports_start_date ON projects_reports(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_reports_end_date ON projects_reports(end_date);

ALTER TABLE projects_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON projects_reports FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_projects_reports_updated_at ON projects_reports;
CREATE TRIGGER update_projects_reports_updated_at
    BEFORE UPDATE ON projects_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration for existing table (if already created with old schema)
ALTER TABLE projects_reports ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE projects_reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects_reports ALTER COLUMN company_id DROP NOT NULL;

SELECT 'Migration completed: projects_reports table created!' as status;
