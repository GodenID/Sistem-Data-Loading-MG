-- ============================================
-- Migration: Add catatan column to loading_history_reports
-- ============================================

-- Add catatan column (TEXT type, nullable)
ALTER TABLE loading_history_reports 
ADD COLUMN IF NOT EXISTS catatan TEXT;

-- Update the view to include catatan column
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
-- COMPLETION
-- ============================================
SELECT 'Migration completed: catatan column added successfully!' as status;
