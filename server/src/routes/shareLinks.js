const express = require('express');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

function makeToken(len = 32) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function expiryFromDays(days) {
  if (days === null || days === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString();
}

// ---- COMPANY SHARE LINKS ----

// POST /api/company-share-links
router.post('/company-share-links', async (req, res) => {
  try {
    const { company_id, token, password_hash = null, expires_at = null, expiryDays } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id wajib' });
    const t = token || makeToken(32);
    const exp = expires_at !== undefined && expires_at !== null ? expires_at : expiryFromDays(expiryDays ?? null);
    const { rows } = await pool.query(
      'INSERT INTO company_share_links (company_id, token, password_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [company_id, t, password_hash, exp]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Token sudah dipakai, coba lagi' });
    res.status(500).json({ error: 'Gagal buat company share link' });
  }
});

// GET /api/company-share-links?companyId=
router.get('/company-share-links', async (req, res) => {
  try {
    if (!req.query.companyId) return res.status(400).json({ error: 'companyId wajib' });
    const { rows } = await pool.query(
      'SELECT * FROM company_share_links WHERE company_id = $1 ORDER BY created_at DESC',
      [req.query.companyId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil company share links' });
  }
});

// GET /api/company-share-links/token/:token (validate, join company)
router.get('/company-share-links/token/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT csl.*, c.*,
        c.name AS company_name, c.slug AS company_slug
       FROM company_share_links csl JOIN companies_reports c ON c.id = csl.company_id
       WHERE csl.token = $1 LIMIT 1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ valid: false, data: null, message: 'Link tidak ditemukan' });
    const link = rows[0];
    // embed company object seperti supabase join companies_reports:company_id (*)
    link.companies_reports = { ...rows[0] };
    if (!link.is_active) return res.json({ valid: false, data: null, message: 'Link sudah dinonaktifkan' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.json({ valid: false, data: null, message: 'Link sudah kadaluarsa' });
    }
    res.json({ valid: true, data: link, message: 'Link valid', requirePassword: !!link.password_hash });
  } catch (e) {
    res.status(500).json({ error: 'Gagal validasi link' });
  }
});

// POST /api/company-share-links/token/:token/access { password_hash }
router.post('/company-share-links/token/:token/access', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT csl.*, c.name AS company_name, c.slug AS company_slug
       FROM company_share_links csl JOIN companies_reports c ON c.id = csl.company_id
       WHERE csl.token = $1 LIMIT 1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ success: false, data: null, message: 'Link tidak ditemukan' });
    const link = rows[0];
    const given = req.body.password_hash ?? req.body.password ?? null;
    if (link.password_hash) {
      if (!given || given !== link.password_hash) {
        return res.json({ success: false, data: null, message: 'Password salah' });
      }
    }
    await pool.query(
      'UPDATE company_share_links SET access_count = access_count + 1, last_accessed_at = NOW() WHERE token = $1',
      [req.params.token]
    );
    res.json({ success: true, data: link, message: 'Akses berhasil' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal akses link' });
  }
});

// PATCH /api/company-share-links/:id
router.patch('/company-share-links/:id', async (req, res) => {
  try {
    const allowed = ['password_hash', 'expires_at', 'is_active'];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (req.body.expiryDays !== undefined) {
      data.expires_at = req.body.expiryDays === null ? null : expiryFromDays(req.body.expiryDays);
    }
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'Tidak ada field valid' });
    const set = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE company_share_links SET ${set} WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((k) => data[k]), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Link tidak ditemukan' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Gagal update link' });
  }
});

// DELETE /api/company-share-links/:id
router.delete('/company-share-links/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM company_share_links WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus link' });
  }
});

// ---- SINGLE-DOC SHARE LINKS (share_links) ----

// POST /api/share-links
router.post('/share-links', async (req, res) => {
  try {
    const { history_id, token, password_hash = null, expires_at = null, expiryDays } = req.body;
    if (!history_id) return res.status(400).json({ error: 'history_id wajib' });
    const t = token || makeToken(32);
    const exp = expires_at !== undefined && expires_at !== null ? expires_at : expiryFromDays(expiryDays ?? null);
    const { rows } = await pool.query(
      'INSERT INTO share_links (history_id, token, password_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [history_id, t, password_hash, exp]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Token sudah dipakai, coba lagi' });
    res.status(500).json({ error: 'Gagal buat share link' });
  }
});

// GET /api/share-links/token/:token
router.get('/share-links/token/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sl.*, lh.* FROM share_links sl JOIN loading_history_reports lh ON lh.id = sl.history_id
       WHERE sl.token = $1 LIMIT 1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ valid: false, data: null, message: 'Link tidak ditemukan' });
    const link = rows[0];
    if (!link.is_active) return res.json({ valid: false, data: null, message: 'Link sudah dinonaktifkan' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.json({ valid: false, data: null, message: 'Link sudah kadaluarsa' });
    }
    res.json({ valid: true, data: link, message: 'Link valid', requirePassword: !!link.password_hash });
  } catch (e) {
    res.status(500).json({ error: 'Gagal validasi link' });
  }
});

// POST /api/share-links/token/:token/access
router.post('/share-links/token/:token/access', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM share_links WHERE token = $1 LIMIT 1', [req.params.token]);
    if (!rows.length) return res.status(404).json({ success: false, data: null, message: 'Link tidak ditemukan' });
    const link = rows[0];
    const given = req.body.password_hash ?? req.body.password ?? null;
    if (link.password_hash) {
      if (!given || given !== link.password_hash) {
        return res.json({ success: false, data: null, message: 'Password salah' });
      }
    }
    await pool.query(
      'UPDATE share_links SET access_count = access_count + 1, last_accessed_at = NOW() WHERE token = $1',
      [req.params.token]
    );
    const full = await pool.query(
      `SELECT sl.*, lh.* FROM share_links sl JOIN loading_history_reports lh ON lh.id = sl.history_id WHERE sl.token = $1 LIMIT 1`,
      [req.params.token]
    );
    res.json({ success: true, data: full.rows[0], message: 'Akses berhasil' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal akses link' });
  }
});

// PATCH /api/share-links/:id | DELETE /api/share-links/:id
router.patch('/share-links/:id', async (req, res) => {
  try {
    const allowed = ['password_hash', 'expires_at', 'is_active'];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'Tidak ada field valid' });
    const set = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE share_links SET ${set} WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((k) => data[k]), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Link tidak ditemukan' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Gagal update link' });
  }
});

router.delete('/share-links/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM share_links WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus link' });
  }
});

module.exports = router;
