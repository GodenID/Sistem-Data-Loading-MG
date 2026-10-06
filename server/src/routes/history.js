const express = require('express');
const pool = require('../db');
const { notifyNewUpload } = require('../notify');

const router = express.Router();

const SORT_MAP = { date: 'lh.date', pic: 'lh.pic', photos: 'lh.photo_count', created: 'lh.created_at' };

function buildHistoryWhere(q, values) {
  const conds = [];
  if (q.companyId) {
    values.push(Number(q.companyId));
    conds.push(`lh.company_id = $${values.length}`);
  } else if (q.companyIds) {
    const ids = String(q.companyIds).split(',').map(Number).filter(Boolean);
    if (ids.length) {
      if (q.picSearch) {
        const safe = String(q.picSearch).replace(/[%(),]/g, ' ').trim().slice(0, 80);
        values.push(ids, `%${safe}%`);
        conds.push(`(lh.company_id = ANY($${values.length - 1}) OR lh.pic ILIKE $${values.length})`);
      } else {
        values.push(ids);
        conds.push(`lh.company_id = ANY($${values.length})`);
      }
    }
  } else if (q.picSearch) {
    const safe = String(q.picSearch).replace(/[%(),]/g, ' ').trim().slice(0, 80);
    if (safe) {
      values.push(`%${safe}%`);
      conds.push(`lh.pic ILIKE $${values.length}`);
    }
  }
  if (q.type) {
    values.push(q.type);
    conds.push(`lh.type = $${values.length}`);
  }
  if (q.dateFrom) {
    values.push(q.dateFrom);
    conds.push(`lh.date >= $${values.length}`);
  }
  if (q.dateTo) {
    values.push(q.dateTo);
    conds.push(`lh.date <= $${values.length}`);
  }
  if (q.code) {
    const safe = String(q.code).replace(/[%(),]/g, ' ').trim().slice(0, 32);
    if (safe) {
      values.push(`%${safe}%`);
      conds.push(`lh.code ILIKE $${values.length}`);
    }
  }
  if (q.crewUserId) {
    values.push(Number(q.crewUserId));
    conds.push(`EXISTS (SELECT 1 FROM history_crew hc WHERE hc.history_id = lh.id AND hc.user_id = $${values.length})`);
  }
  return conds.length ? `WHERE ${conds.join(' AND ')}` : '';
}

// Tempel daftar tim (user berakun) ke tiap baris history — 1 query batch.
async function attachCrew(rows) {
  const ids = [...new Set(rows.map((r) => r.id))];
  if (!ids.length) return rows;
  const { rows: crew } = await pool.query(
    `SELECT hc.history_id, u.id, u.username, u.name
     FROM history_crew hc JOIN users u ON u.id = hc.user_id
     WHERE hc.history_id = ANY($1) ORDER BY u.name ASC`,
    [ids]
  );
  const map = {};
  crew.forEach((c) => {
    (map[c.history_id] = map[c.history_id] || []).push({ id: c.id, username: c.username, name: c.name });
  });
  return rows.map((r) => ({ ...r, crew: map[r.id] || [] }));
}

// Ganti total tim satu dokumentasi (hanya id user yang ada).
async function replaceCrew(historyId, userIds = []) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))].slice(0, 20);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM history_crew WHERE history_id = $1', [historyId]);
    if (ids.length) {
      const ok = await client.query('SELECT id FROM users WHERE id = ANY($1) AND is_active = TRUE', [ids]);
      const valid = ok.rows.map((r) => r.id);
      for (const uid of valid) {
        await client.query(
          'INSERT INTO history_crew (history_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [historyId, uid]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function mapRow(r) {
  return {
    ...r,
    companyName: r.company_name || 'Unknown',
    companySales: r.company_sales || null,
    companySlug: r.company_slug || null,
  };
}

// GET /api/history?filters...
router.get('/', async (req, res) => {
  try {
    const sortCol = SORT_MAP[req.query.sortBy] || 'lh.date';
    const dir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const values = [];
    const where = buildHistoryWhere(req.query, values);

    let order = `ORDER BY ${sortCol} ${dir}`;
    if (sortCol === 'lh.date') order += `, lh.created_at ${dir}`;

    if (req.query.page && req.query.limit) {
      const p = Math.max(1, parseInt(req.query.page, 10) || 1);
      const l = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const countR = await pool.query(
        `SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${where}`,
        values
      );
      const count = countR.rows[0].c;
      const offset = (p - 1) * l;
      const { rows } = await pool.query(
        `SELECT lh.*, c.name AS company_name, c.sales_name AS company_sales, c.slug AS company_slug
         FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id
         ${where} ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, l, offset]
      );
      return res.json({ data: await attachCrew(rows.map(mapRow)), count });
    }

    const { rows } = await pool.query(
      `SELECT lh.*, c.name AS company_name, c.sales_name AS company_sales, c.slug AS company_slug
       FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id
       ${where} ${order}`,
      values
    );
    res.json(await attachCrew(rows.map(mapRow)));
  } catch (e) {
    console.error('GET /history:', e.message);
    res.status(500).json({ error: 'Gagal ambil history' });
  }
});

// GET /api/history/summary
router.get('/summary', async (req, res) => {
  try {
    const v1 = [];
    const w1 = buildHistoryWhere(req.query, v1);
    const v2 = [];
    const w2 = buildHistoryWhere({ ...req.query, type: 'loading' }, v2);
    const v3 = [];
    const w3 = buildHistoryWhere({ ...req.query, type: 'perawatan' }, v3);
    const v4 = [];
    const w4 = buildHistoryWhere(req.query, v4);
    const [total, loading, perawatan, media] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w1}`, v1),
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w2}`, v2),
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w3}`, v3),
      pool.query(`SELECT photo_count FROM loading_history_reports lh ${w4} LIMIT 10000`, v4),
    ]);
    const mediaCount = media.rows.reduce((a, r) => a + (r.photo_count || 0), 0);
    res.json({
      total: total.rows[0].c,
      loading: loading.rows[0].c,
      perawatan: perawatan.rows[0].c,
      media: mediaCount,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil summary' });
  }
});

// GET /api/history/heatmap?days=90
router.get('/heatmap', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startStr = start.toISOString().split('T')[0];
    const { rows } = await pool.query(
      'SELECT date, type, photo_count FROM loading_history_reports WHERE date >= $1 ORDER BY date ASC LIMIT 5000',
      [startStr]
    );
    const map = {};
    rows.forEach((row) => {
      const key = new Date(row.date).toISOString().split('T')[0];
      if (!map[key]) map[key] = { loading: 0, perawatan: 0, media: 0, total: 0 };
      const d = map[key];
      if (row.type === 'perawatan') d.perawatan += 1;
      else d.loading += 1;
      d.media += row.photo_count || 0;
      d.total += 1;
    });
    res.json({ map, total: rows.length, startStr });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil heatmap' });
  }
});

// GET /api/history/stats (total counts)
router.get('/stats', async (_req, res) => {
  try {
    const [c, h, l, p] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM companies_reports'),
      pool.query('SELECT COUNT(*)::int AS c FROM loading_history_reports'),
      pool.query("SELECT COUNT(*)::int AS c FROM loading_history_reports WHERE type = 'loading'"),
      pool.query("SELECT COUNT(*)::int AS c FROM loading_history_reports WHERE type = 'perawatan'"),
    ]);
    res.json({
      totalCompanies: c.rows[0].c,
      totalHistory: h.rows[0].c,
      totalLoading: l.rows[0].c,
      totalPerawatan: p.rows[0].c,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil statistics' });
  }
});

// GET /api/history/check-duplicate?companyId=&date=&type=&excludeId=
router.get('/check-duplicate', async (req, res) => {
  try {
    const { companyId, date, type, excludeId } = req.query;
    if (!companyId || !date || !type) return res.status(400).json({ error: 'companyId, date, type wajib' });
    const values = [Number(companyId), date, type];
    let sql = 'SELECT COUNT(*)::int AS c FROM loading_history_reports WHERE company_id = $1 AND date = $2 AND type = $3';
    if (excludeId) {
      values.push(Number(excludeId));
      sql += ` AND id <> $${values.length}`;
    }
    const { rows } = await pool.query(sql, values);
    res.json({ duplicate: rows[0].c > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Gagal cek duplikat' });
  }
});

// GET /api/history/top-uploaders?from=&to=&limit=
router.get('/top-uploaders', async (req, res) => {
  try {
    const { from, to } = req.query;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const values = [];
    const conds = [];
    if (from) {
      values.push(from);
      conds.push(`lh.date >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      conds.push(`lh.date <= $${values.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT lh.company_id, c.name AS company_name, lh.photo_count
       FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id ${where}`,
      values
    );
    const grouped = {};
    rows.forEach((r) => {
      if (!grouped[r.company_id]) {
        grouped[r.company_id] = { companyId: r.company_id, companyName: r.company_name || 'Unknown', uploadCount: 0, totalPhotos: 0 };
      }
      grouped[r.company_id].uploadCount += 1;
      grouped[r.company_id].totalPhotos += r.photo_count || 0;
    });
    res.json(Object.values(grouped).sort((a, b) => b.uploadCount - a.uploadCount).slice(0, limit));
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil top uploaders' });
  }
});

// GET /api/history/hourly?from=&to=
router.get('/hourly', async (req, res) => {
  try {
    const values = [];
    const conds = [];
    if (req.query.from) {
      values.push(req.query.from);
      conds.push(`date >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(req.query.to);
      conds.push(`date <= $${values.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT created_at FROM loading_history_reports ${where}`, values);
    const hours = new Array(24).fill(0);
    rows.forEach((r) => {
      hours[new Date(r.created_at).getHours()] += 1;
    });
    res.json(hours.map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, count })));
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil hourly' });
  }
});

function duplicateMessage(type) {
  return type === 'perawatan'
    ? 'Sudah ada data perawatan untuk perusahaan ini pada tanggal yang sama.'
    : 'Sudah ada data loading untuk perusahaan ini pada tanggal yang sama.';
}

// Kode unik: LOAD-2026-0001 / RWT-2026-0001 (nomor per tipe+tahun).
// Counter di-lock per transaksi agar tidak dobel saat upload barengan.
async function nextCode(client, type, dateStr) {
  const year = new Date(dateStr).getFullYear() || new Date().getFullYear();
  await client.query(
    'INSERT INTO doc_counters (type, year, last_no) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING',
    [type, year]
  );
  const { rows } = await client.query(
    'SELECT last_no FROM doc_counters WHERE type = $1 AND year = $2 FOR UPDATE',
    [type, year]
  );
  const no = (rows[0]?.last_no || 0) + 1;
  await client.query('UPDATE doc_counters SET last_no = $1 WHERE type = $2 AND year = $3', [no, type, year]);
  const prefix = type === 'perawatan' ? 'RWT' : 'LOAD';
  return `${prefix}-${year}-${String(no).padStart(4, '0')}`;
}

// POST /api/history
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, date, pic, type, photo_count = 0, catatan = null, crew = [] } = req.body;
    if (!company_id || !date || !pic || !type) {
      return res.status(400).json({ error: 'company_id, date, pic, type wajib' });
    }
    await client.query('BEGIN');
    const code = await nextCode(client, type, date);
    const inserted = await client.query(
      'INSERT INTO loading_history_reports (company_id, date, pic, type, photo_count, catatan, code) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [company_id, date, pic, type, photo_count, catatan, code]
    );
    await client.query('COMMIT');
    const rows = inserted.rows;
    if (Array.isArray(crew) && crew.length) {
      try {
        await replaceCrew(rows[0].id, crew);
      } catch (e) {
        console.warn('Gagal simpan tim:', e.message);
      }
    }
    const withCrew = await attachCrew([mapRow(rows[0])]);
    // Notifikasi Telegram (gagal kirim tidak menggagalkan insert)
    try {
      const comp = await pool.query('SELECT name, slug FROM companies_reports WHERE id = $1', [company_id]);
      await notifyNewUpload(
        rows[0],
        comp.rows[0] || {},
        (withCrew[0].crew || []).map((c) => c.name || c.username)
      );
    } catch (e) {
      console.warn('Gagal notifikasi:', e.message);
    }
    res.status(201).json(withCrew[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return res.status(409).json({ error: duplicateMessage(req.body?.type) });
    console.error('POST /history:', e.message);
    res.status(500).json({ error: 'Gagal tambah history' });
  } finally {
    client.release();
  }
});

// PATCH /api/history/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['company_id', 'date', 'pic', 'type', 'photo_count', 'catatan'];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'Tidak ada field valid' });
    const set = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE loading_history_reports SET ${set}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((k) => data[k]), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'History tidak ditemukan' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: duplicateMessage(req.body?.type) });
    res.status(500).json({ error: 'Gagal update history' });
  }
});

// DELETE /api/history/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM loading_history_reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus history' });
  }
});

// GET /api/history/:id/crew
router.get('/:id/crew', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.name
       FROM history_crew hc JOIN users u ON u.id = hc.user_id
       WHERE hc.history_id = $1 ORDER BY u.name ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil tim' });
  }
});

// POST /api/history/:id/crew { userIds: [...] } — ganti total tim
router.post('/:id/crew', async (req, res) => {
  try {
    const ids = Array.isArray(req.body) ? req.body : req.body.userIds || req.body.crew || [];
    await replaceCrew(Number(req.params.id), ids);
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.name
       FROM history_crew hc JOIN users u ON u.id = hc.user_id
       WHERE hc.history_id = $1 ORDER BY u.name ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal simpan tim' });
  }
});

// GET /api/history/:id/photos
router.get('/:id/photos', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM photos_reports WHERE history_id = $1 ORDER BY sort_order ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil photos' });
  }
});

// PUT /api/history/:id/photos (replace all — dipakai updatePhotos)
router.put('/:id/photos', async (req, res) => {
  const client = await pool.connect();
  try {
    const photos = Array.isArray(req.body) ? req.body : req.body.photos || [];
    await client.query('BEGIN');
    await client.query('DELETE FROM photos_reports WHERE history_id = $1', [req.params.id]);
    if (photos.length) {
      const vals = [];
      const ph = photos.map((p, i) => {
        vals.push(p.history_id || Number(req.params.id), p.url, p.filename, p.size_bytes || null, p.sort_order ?? i + 1);
        const b = i * 5;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
      });
      await client.query(
        `INSERT INTO photos_reports (history_id, url, filename, size_bytes, sort_order) VALUES ${ph.join(', ')}`,
        vals
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM photos_reports WHERE history_id = $1 ORDER BY sort_order ASC', [
      req.params.id,
    ]);
    res.json(rows);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Gagal update photos' });
  } finally {
    client.release();
  }
});

module.exports = router;
