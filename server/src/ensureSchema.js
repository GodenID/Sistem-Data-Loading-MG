const pool = require('./db');

// Pastikan UNIQUE (company_id, date, type) ada di loading_history_reports.
// NON-DESTRUKTIF: tidak menghapus data. Kalau sudah ada duplikat lama,
// constraint gagal dibuat -> hanya log peringatan; bersihkan manual lewat
// database/migration_add_unique_loading.sql lalu restart server.
async function ensureUniqueLoading() {
  const NAME = 'uq_loading_history_company_date_type';
  try {
    const has = await pool.query('SELECT 1 FROM pg_constraint WHERE conname = $1', [NAME]);
    if (has.rows.length) return;

    await pool.query(
      `ALTER TABLE loading_history_reports
         ADD CONSTRAINT ${NAME} UNIQUE (company_id, date, type)`
    );
    console.log(`[schema] constraint ${NAME} dibuat`);
  } catch (e) {
    if (e.code === '23505') {
      let n = '?';
      try {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS c FROM (
             SELECT 1 FROM loading_history_reports
             GROUP BY company_id, date, type HAVING COUNT(*) > 1
           ) d`
        );
        n = r.rows[0].c;
      } catch { /* abaikan */ }
      console.warn(
        `[schema] PERINGATAN: ${n} grup data duplikat (perusahaan+tanggal+tipe) masih ada, ` +
          `constraint ${NAME} belum bisa dibuat. Jalankan database/migration_add_unique_loading.sql lalu restart API.`
      );
    } else {
      console.warn('[schema] gagal cek constraint:', e.message);
    }
  }
}

module.exports = { ensureUniqueLoading };
