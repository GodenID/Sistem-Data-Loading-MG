const express = require('express');
const pool = require('../db');

const router = express.Router();

const COMPANY_FIELDS = [
  'name', 'address', 'pic_name', 'contact', 'sales_name',
  'tanaman_meja', 'tanaman_lantai', 'anggrek', 'anggrek_bulan', 'anggrek_dendro',
  'planter_box', 'vertical_garden', 'mini_garden',
  'center_piece', 'pic_loading', 'slug', 'logo_url', 'category', 'notes',
];

function pickCompanyFields(body = {}) {
  const out = {};
  for (const f of COMPANY_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '') out[f] = body[f];
  }
  return out;
}

function generateSlug(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'company';
}

// GET /api/companies?search=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const values = [];
    let where = '';
    if (search && String(search).trim()) {
      const safe = String(search).replace(/[%(),]/g, ' ').trim().slice(0, 80);
      if (safe) {
        values.push(`%${safe}%`, `%${safe}%`);
        where = `WHERE name ILIKE $${values.length - 1} OR address ILIKE $${values.length}`;
      }
    }

    if (page && limit) {
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const countR = await pool.query(`SELECT COUNT(*)::int AS c FROM companies_reports ${where}`, values);
      const count = countR.rows[0].c;
      const offset = (p - 1) * l;
      const { rows } = await pool.query(
        `SELECT * FROM companies_reports ${where} ORDER BY name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, l, offset]
      );
      return res.json({ data: rows, count });
    }

    const { rows } = await pool.query(
      `SELECT * FROM companies_reports ${where} ORDER BY name ASC`,
      values
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /companies:', e.message);
    res.status(500).json({ error: 'Gagal ambil companies' });
  }
});

// GET /api/companies/count
router.get('/count', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM companies_reports');
    res.json({ count: rows[0].count });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hitung companies' });
  }
});

// GET /api/companies/active?ids=1,2&since=2026-01-01
router.get('/active', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean).slice(0, 5000);
    const since = req.query.since;
    if (!ids.length || !since) return res.json([]);
    const { rows } = await pool.query(
      'SELECT DISTINCT company_id FROM loading_history_reports WHERE company_id = ANY($1) AND date >= $2 LIMIT 5000',
      [ids, since]
    );
    res.json(rows.map((r) => r.company_id));
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil active companies' });
  }
});

// GET /api/companies/slug/:slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies_reports WHERE slug = $1 LIMIT 1', [
      req.params.slug,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Company tidak ditemukan' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil company' });
  }
});

// POST /api/companies
router.post('/', async (req, res) => {
  try {
    const data = pickCompanyFields(req.body);
    if (!data.name) return res.status(400).json({ error: 'Nama company wajib' });
    const baseSlug = data.slug || generateSlug(data.name);

    for (let attempt = 0; attempt < 20; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const cols = Object.keys(data).filter((k) => k !== 'slug');
      const vals = cols.map((k) => data[k]);
      try {
        const { rows } = await pool.query(
          `INSERT INTO companies_reports (${['slug', ...cols].join(', ')}) VALUES (${['$1', ...cols.map((_, i) => `$${i + 2}`)].join(', ')}) RETURNING *`,
          [slug, ...vals]
        );
        return res.status(201).json(rows[0]);
      } catch (e) {
        if (e.code === '23505') continue; // slug collision -> coba suffix
        if (e.code === '42703') {
          // kolom belum ada (DB lama) -> drop kolom tsb & retry sekali
          const m = /column\s+"?(\w+)"?/i.exec(e.message || '');
          if (m && data[m[1]] !== undefined) {
            delete data[m[1]];
            attempt -= 1;
            continue;
          }
        }
        throw e;
      }
    }
    res.status(409).json({ error: 'Gagal membuat slug unik' });
  } catch (e) {
    console.error('POST /companies:', e.message);
    res.status(500).json({ error: 'Gagal tambah company' });
  }
});

// PATCH /api/companies/:id
router.patch('/:id', async (req, res) => {
  try {
    const data = pickCompanyFields(req.body);
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'Tidak ada field valid' });
    const set = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE companies_reports SET ${set}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((k) => data[k]), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Company tidak ditemukan' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '42703') return res.status(400).json({ error: `Kolom belum ada: ${e.message}` });
    console.error('PATCH /companies:', e.message);
    res.status(500).json({ error: 'Gagal update company' });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM companies_reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus company' });
  }
});

module.exports = router;
