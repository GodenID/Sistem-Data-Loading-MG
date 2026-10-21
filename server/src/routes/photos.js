const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/photos/gallery — khusus login (internal). Lihat README auth.

// GET /api/photos/gallery?page=&limit=&companyId=&type=&dateFrom=&dateTo=&crewUserId=
// Arsip semua media (foto+video), terbaru dulu, paginasi.
router.get('/gallery', requireAuth, async (req, res) => {
  try {
    const values = [];
    const conds = [];
    if (req.query.companyId) {
      values.push(Number(req.query.companyId));
      conds.push(`lh.company_id = $${values.length}`);
    }
    if (req.query.type) {
      values.push(req.query.type);
      conds.push(`lh.type = $${values.length}`);
    }
    if (req.query.dateFrom) {
      values.push(req.query.dateFrom);
      conds.push(`lh.date >= $${values.length}`);
    }
    if (req.query.dateTo) {
      values.push(req.query.dateTo);
      conds.push(`lh.date <= $${values.length}`);
    }
    if (req.query.crewUserId) {
      values.push(Number(req.query.crewUserId));
      conds.push(`EXISTS (SELECT 1 FROM history_crew hc WHERE hc.history_id = lh.id AND hc.user_id = $${values.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const p = Math.max(1, parseInt(req.query.page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 60));

    const countR = await pool.query(
      `SELECT COUNT(*)::int AS c FROM photos_reports p JOIN loading_history_reports lh ON lh.id = p.history_id ${where}`,
      values
    );
    const offset = (p - 1) * l;
    const { rows } = await pool.query(
      `SELECT p.id, p.history_id, p.url, p.filename, p.size_bytes, p.sort_order, p.created_at,
        lh.date, lh.type, lh.pic, lh.code, lh.company_id,
        c.name AS company_name, c.slug AS company_slug
       FROM photos_reports p
       JOIN loading_history_reports lh ON lh.id = p.history_id
       LEFT JOIN companies_reports c ON c.id = lh.company_id
       ${where}
       ORDER BY lh.date DESC, p.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, l, offset]
    );
    res.json({ data: rows, count: countR.rows[0].c });
  } catch (e) {
    console.error('GET /photos/gallery:', e.message);
    res.status(500).json({ error: 'Gagal ambil galeri' });
  }
});

// POST /api/photos (single atau bulk via array)
// Idempotent: pasangan (history_id, url) yang sudah ada dilewati, jadi kalau
// klien kirim ulang karena jaringan lemot, foto tidak jadi dobel.
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    if (!body.length || !body[0].history_id || !body[0].url || !body[0].filename) {
      return res.status(400).json({ error: 'history_id, url, filename wajib' });
    }
    const historyIds = [...new Set(body.map((p) => Number(p.history_id)).filter(Boolean))].sort((a, b) => a - b);
    const urls = body.map((p) => p.url);

    await client.query('BEGIN');
    for (const hid of historyIds) {
      await client.query('SELECT pg_advisory_xact_lock($1)', [hid]);
    }
    const existing = await client.query(
      'SELECT history_id, url FROM photos_reports WHERE history_id = ANY($1) AND url = ANY($2)',
      [historyIds, urls]
    );
    const seen = new Set(existing.rows.map((r) => `${r.history_id}|${r.url}`));
    const fresh = [];
    body.forEach((p, i) => {
      const key = `${p.history_id}|${p.url}`;
      if (seen.has(key)) return;
      seen.add(key);
      fresh.push({ ...p, _order: p.sort_order ?? i + 1 });
    });

    let rows;
    if (fresh.length) {
      const vals = [];
      const ph = fresh.map((p, i) => {
        vals.push(p.history_id, p.url, p.filename, p.size_bytes || null, p._order);
        const b = i * 5;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
      });
      const ins = await client.query(
        `INSERT INTO photos_reports (history_id, url, filename, size_bytes, sort_order) VALUES ${ph.join(', ')} RETURNING *`,
        vals
      );
      rows = ins.rows;
    } else {
      // Semua sudah tersimpan (request ulang) -> kembalikan yang sudah ada
      const cur = await client.query(
        'SELECT * FROM photos_reports WHERE history_id = ANY($1) AND url = ANY($2) ORDER BY sort_order ASC',
        [historyIds, urls]
      );
      rows = cur.rows;
    }
    await client.query('COMMIT');
    res.status(201).json(Array.isArray(req.body) ? rows : rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /photos:', e.message);
    res.status(500).json({ error: 'Gagal tambah photo' });
  } finally {
    client.release();
  }
});

// DELETE /api/photos/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM photos_reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus photo' });
  }
});

module.exports = router;
