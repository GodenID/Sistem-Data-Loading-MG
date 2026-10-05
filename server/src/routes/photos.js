const express = require('express');
const pool = require('../db');

const router = express.Router();

// POST /api/photos (single atau bulk via array)
router.post('/', async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    if (!body.length || !body[0].history_id || !body[0].url || !body[0].filename) {
      return res.status(400).json({ error: 'history_id, url, filename wajib' });
    }
    const vals = [];
    const ph = body.map((p, i) => {
      vals.push(p.history_id, p.url, p.filename, p.size_bytes || null, p.sort_order ?? i + 1);
      const b = i * 5;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
    });
    const { rows } = await pool.query(
      `INSERT INTO photos_reports (history_id, url, filename, size_bytes, sort_order) VALUES ${ph.join(', ')} RETURNING *`,
      vals
    );
    res.status(201).json(Array.isArray(req.body) ? rows : rows[0]);
  } catch (e) {
    console.error('POST /photos:', e.message);
    res.status(500).json({ error: 'Gagal tambah photo' });
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
