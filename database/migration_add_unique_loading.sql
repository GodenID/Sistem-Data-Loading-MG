-- ============================================
-- Cegah duplikat loading/perawatan per perusahaan per tanggal
-- Satu perusahaan hanya boleh punya 1 loading + 1 perawatan per tanggal.
-- Kode aplikasi sudah cek via checkLoadingDuplicate() SEBELUM upload S3,
-- constraint ini pengaman terakhir anti race-condition.
-- ============================================

-- Bersihkan duplikat yang sudah terlanjur ada.
-- Yang dipertahankan: baris dengan foto terbanyak (lalu id terkecil), supaya
-- baris kosong hasil double-submit yang dihapus, bukan baris yang berisi foto.
-- (Foto/share link/tim baris yang dihapus ikut terhapus via ON DELETE CASCADE.)
DELETE FROM loading_history_reports d
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lh.company_id, lh.date, lh.type
           ORDER BY (SELECT COUNT(*) FROM photos_reports p WHERE p.history_id = lh.id) DESC, lh.id ASC
         ) AS rn
  FROM loading_history_reports lh
) ranked
WHERE d.id = ranked.id
  AND ranked.rn > 1;

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
