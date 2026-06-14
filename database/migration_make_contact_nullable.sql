-- ============================================
-- Migration: Make contact column nullable in companies_reports
-- ============================================

-- Allow contact to be empty/null (previously NOT NULL caused insert failures
-- when the contact field was left blank in the form).
ALTER TABLE companies_reports
ALTER COLUMN contact DROP NOT NULL;

-- ============================================
-- COMPLETION
-- ============================================
SELECT 'Migration completed: contact column is now nullable!' as status;
