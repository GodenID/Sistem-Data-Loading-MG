const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Semua endpoint tim butuh login (staff maupun admin) —
// daftar username tidak dibuka ke publik.
router.use(requireAuth);

// GET /api/team?search= — user aktif untuk picker tim
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const values = [];
    let where = 'WHERE is_active = TRUE';
    if (search && String(search).trim()) {
      const safe = String(search).replace(/[%(),]/g, ' ').trim().slice(0, 80);
      if (safe) {
        values.push(`%${safe}%`, `%${safe}%`);
        where += ` AND (username ILIKE $${values.length - 1} OR name ILIKE $${values.length})`;
      }
    }
    const { rows } = await pool.query(
      `SELECT id, username, name, role FROM users ${where} ORDER BY name ASC`,
      values
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil tim' });
  }
});

// GET /api/team/stats — performa per user (loading/perawatan/media/terakhir aktif)
router.get('/stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.is_active,
        COUNT(*) FILTER (WHERE lh.type = 'loading')::int AS loading,
        COUNT(*) FILTER (WHERE lh.type = 'perawatan')::int AS perawatan,
        COUNT(*)::int AS total,
        COALESCE(SUM(lh.photo_count), 0)::int AS media,
        MAX(lh.date) AS last_date
       FROM users u
       LEFT JOIN history_crew hc ON hc.user_id = u.id
       LEFT JOIN loading_history_reports lh ON lh.id = hc.history_id
       GROUP BY u.id
       ORDER BY total DESC, u.name ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil statistik tim' });
  }
});

// GET /api/team/:id/history?limit= — riwayat dokumentasi satu user
router.get('/:id/history', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { rows } = await pool.query(
      `SELECT lh.*, c.name AS company_name, c.slug AS company_slug
       FROM history_crew hc
       JOIN loading_history_reports lh ON lh.id = hc.history_id
       LEFT JOIN companies_reports c ON c.id = lh.company_id
       WHERE hc.user_id = $1
       ORDER BY lh.date DESC, lh.created_at DESC
       LIMIT $2`,
      [req.params.id, limit]
    );
    res.json(
      rows.map((r) => ({
        ...r,
        companyName: r.company_name || 'Unknown',
        companySlug: r.company_slug || null,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil riwayat user' });
  }
});

module.exports = router;
