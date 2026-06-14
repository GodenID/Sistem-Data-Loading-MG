-- ============================================
-- Migration: Make address & pic_name nullable in companies_reports
-- ============================================

-- Allow address and pic_name to be empty/null. The insert code skips blank
-- fields, so NOT NULL on these columns caused 400 errors when left empty.
ALTER TABLE companies_reports
ALTER COLUMN address DROP NOT NULL;

ALTER TABLE companies_reports
ALTER COLUMN pic_name DROP NOT NULL;

-- ============================================
-- COMPLETION
-- ============================================
SELECT 'Migration completed: address & pic_name columns are now nullable!' as status;
