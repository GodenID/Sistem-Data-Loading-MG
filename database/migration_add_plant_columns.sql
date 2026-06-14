-- ============================================
-- Migration: Add Plant Count Columns to companies_reports
-- ============================================

-- Tambahkan kolom jumlah tanaman jika belum ada
DO $$
BEGIN
    -- Tanaman Meja
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'tanaman_meja') THEN
        ALTER TABLE companies_reports ADD COLUMN tanaman_meja INTEGER DEFAULT 0;
    END IF;

    -- Tanaman Lantai
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'tanaman_lantai') THEN
        ALTER TABLE companies_reports ADD COLUMN tanaman_lantai INTEGER DEFAULT 0;
    END IF;

    -- Anggrek
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'anggrek') THEN
        ALTER TABLE companies_reports ADD COLUMN anggrek INTEGER DEFAULT 0;
    END IF;

    -- Vertical Garden
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'vertical_garden') THEN
        ALTER TABLE companies_reports ADD COLUMN vertical_garden INTEGER DEFAULT 0;
    END IF;

    -- Mini Garden
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'mini_garden') THEN
        ALTER TABLE companies_reports ADD COLUMN mini_garden INTEGER DEFAULT 0;
    END IF;

    -- Center Piece
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'companies_reports' AND column_name = 'center_piece') THEN
        ALTER TABLE companies_reports ADD COLUMN center_piece INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update existing records yang NULL jadi 0
UPDATE companies_reports 
SET 
    tanaman_meja = COALESCE(tanaman_meja, 0),
    tanaman_lantai = COALESCE(tanaman_lantai, 0),
    anggrek = COALESCE(anggrek, 0),
    vertical_garden = COALESCE(vertical_garden, 0),
    mini_garden = COALESCE(mini_garden, 0),
    center_piece = COALESCE(center_piece, 0)
WHERE 
    tanaman_meja IS NULL 
    OR tanaman_lantai IS NULL 
    OR anggrek IS NULL 
    OR vertical_garden IS NULL 
    OR mini_garden IS NULL 
    OR center_piece IS NULL;

SELECT 'Migration completed: Plant count columns added successfully!' as status;
