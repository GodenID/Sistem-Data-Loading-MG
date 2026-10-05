-- ============================================
-- Cegah duplikat loading/perawatan per perusahaan per tanggal
-- Satu perusahaan hanya boleh punya 1 loading + 1 perawatan per tanggal.
-- Kode aplikasi sudah cek via checkLoadingDuplicate() SEBELUM upload S3,
-- constraint ini pengaman terakhir anti race-condition.
-- ============================================

-- Bersihkan duplikat yang sudah terlanjur ada (sisakan id terkecil)
DELETE FROM loading_history_reports a
USING loading_history_reports b
WHERE a.id > b.id
  AND a.company_id = b.company_id
  AND a.date = b.date
  AND a.type = b.type;

-- Buat unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_loading_history_company_date_type'
  ) THEN
    ALTER TABLE loading_history_reports
      ADD CONSTRAINT uq_loading_history_company_date_type
      UNIQUE (company_id, date, type);
  END IF;
END
$$;
