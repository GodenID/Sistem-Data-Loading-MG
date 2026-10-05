-- ============================================
-- Hapus kategori "project": semua client jadi "sewa bulanan"
-- UI sudah tidak lagi memakai kolom category, migration ini
-- merapikan data lama agar konsisten.
-- Kolom category TIDAK di-drop (aman untuk rollback).
-- ============================================

UPDATE companies_reports
SET category = 'sewa_bulanan', updated_at = NOW()
WHERE category IS DISTINCT FROM 'sewa_bulanan';
