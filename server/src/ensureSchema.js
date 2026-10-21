const pool = require('./db');

const CONSTRAINT = 'uq_loading_history_company_date_type';

// Kelompokkan duplikat (perusahaan+tanggal+tipe). Yang DIPERTAHANKAN = baris
// dengan foto terbanyak (lalu id terkecil). lost_photos = jumlah foto baris
// duplikat yang URL-nya tidak ada di baris yang dipertahankan.
const DUP_SQL = `
  WITH base AS (
    SELECT lh.id, lh.company_id, lh.date, lh.type, lh.pic, lh.created_at,
           (SELECT COUNT(*) FROM photos_reports p WHERE p.history_id = lh.id)::int AS photos
    FROM loading_history_reports lh
  ), ranked AS (
    SELECT b.*, ROW_NUMBER() OVER (
             PARTITION BY company_id, date, type ORDER BY photos DESC, id ASC) AS rn
    FROM base b
  )
  SELECT d.id, d.company_id, d.date::text AS date, d.type, d.pic, d.photos,
         k.id AS keep_id, k.photos AS keep_photos,
         (SELECT COUNT(*) FROM photos_reports p
           WHERE p.history_id = d.id
             AND p.url NOT IN (SELECT url FROM photos_reports WHERE history_id = k.id))::int AS lost_photos
  FROM ranked d
  JOIN ranked k ON k.company_id = d.company_id AND k.date = d.date AND k.type = d.type AND k.rn = 1
  WHERE d.rn > 1
  ORDER BY d.company_id, d.date, d.type, d.id`;

// Pasang constraint UNIQUE kalau belum ada. NON-DESTRUKTIF.
async function ensureUniqueLoading() {
  try {
    const has = await pool.query('SELECT 1 FROM pg_constraint WHERE conname = $1', [CONSTRAINT]);
    if (has.rows.length) return;

    await pool.query(
      `ALTER TABLE loading_history_reports ADD CONSTRAINT ${CONSTRAINT} UNIQUE (company_id, date, type)`
    );
    console.log(`[schema] constraint ${CONSTRAINT} dibuat`);
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
          `constraint ${CONSTRAINT} belum bisa dibuat. Set DEDUPE_MODE=report untuk melihat daftar, ` +
          `lalu DEDUPE_MODE=apply untuk merapikan.`
      );
    } else {
      console.warn('[schema] gagal cek constraint:', e.message);
    }
  }
}

// Alat sekali-jalan, aktif lewat env DEDUPE_MODE:
//   report -> hanya mencatat apa yang AKAN dilakukan (tidak mengubah data)
//   apply  -> backup ke tabel bak_dup_*, pindahkan foto unik ke baris yang
//             dipertahankan, hapus baris duplikat, pasang constraint (1 transaksi)
async function dedupeLoading(mode) {
  if (mode !== 'report' && mode !== 'apply') return;
  try {
    const { rows } = await pool.query(DUP_SQL);
    const groups = new Set(rows.map((r) => `${r.company_id}|${r.date}|${r.type}`)).size;
    const lost = rows.reduce((a, r) => a + r.lost_photos, 0);
    console.log(`[dedupe] mode=${mode} grup=${groups} baris_duplikat=${rows.length} foto_unik_yang_akan_dipindah=${lost}`);
    rows.forEach((r) =>
      console.log(
        `[dedupe] company=${r.company_id} ${r.date} ${r.type}: pertahankan #${r.keep_id}(${r.keep_photos} foto) ` +
          `hapus #${r.id}(${r.photos} foto, pic="${r.pic}", unik=${r.lost_photos})`
      )
    );
    if (mode === 'report' || !rows.length) return;

    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12); // YYYYMMDDHHMM
    const ids = rows.map((r) => r.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 1) Backup baris yang akan dihapus (beserta relasinya)
      await client.query(`CREATE TABLE bak_dup_history_${stamp} AS SELECT * FROM loading_history_reports WHERE id = ANY($1)`, [ids]);
      await client.query(`CREATE TABLE bak_dup_photos_${stamp} AS SELECT * FROM photos_reports WHERE history_id = ANY($1)`, [ids]);
      await client.query(`CREATE TABLE bak_dup_share_links_${stamp} AS SELECT * FROM share_links WHERE history_id = ANY($1)`, [ids]);
      await client.query(`CREATE TABLE bak_dup_crew_${stamp} AS SELECT * FROM history_crew WHERE history_id = ANY($1)`, [ids]);

      // 2) Pindahkan foto yang tidak ada di baris yang dipertahankan (jangan hilang)
      for (const r of rows) {
        if (!r.lost_photos) continue;
        await client.query(
          `UPDATE photos_reports SET history_id = $1, sort_order = COALESCE(sort_order, 0) + 1000
           WHERE history_id = $2
             AND url NOT IN (SELECT url FROM photos_reports WHERE history_id = $1)`,
          [r.keep_id, r.id]
        );
      }
      // 3) Hapus baris duplikat (sisa foto/share link/tim ikut terhapus via CASCADE)
      await client.query('DELETE FROM loading_history_reports WHERE id = ANY($1)', [ids]);
      // 4) Sinkronkan photo_count baris yang dipertahankan
      const keepIds = [...new Set(rows.map((r) => r.keep_id))];
      await client.query(
        `UPDATE loading_history_reports lh
         SET photo_count = (SELECT COUNT(*) FROM photos_reports p WHERE p.history_id = lh.id)
         WHERE lh.id = ANY($1)`,
        [keepIds]
      );
      // 5) Kunci supaya tidak bisa dobel lagi
      const has = await client.query('SELECT 1 FROM pg_constraint WHERE conname = $1', [CONSTRAINT]);
      if (!has.rows.length) {
        await client.query(`ALTER TABLE loading_history_reports ADD CONSTRAINT ${CONSTRAINT} UNIQUE (company_id, date, type)`);
      }
      await client.query('COMMIT');
      console.log(`[dedupe] SELESAI: ${ids.length} baris dihapus, constraint terpasang. Backup: tabel bak_dup_*_${stamp}`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[dedupe] GAGAL, di-rollback, data tidak berubah:', e.message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[dedupe] error:', e.message);
  }
}

module.exports = { ensureUniqueLoading, dedupeLoading };
