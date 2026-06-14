-- Add logo_url column to companies_reports table
ALTER TABLE companies_reports 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add sales_name column to companies_reports table
ALTER TABLE companies_reports 
ADD COLUMN IF NOT EXISTS sales_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN companies_reports.logo_url IS 'URL logo perusahaan (uploaded to S3)';
COMMENT ON COLUMN companies_reports.sales_name IS 'Nama sales yang handle client ini';
