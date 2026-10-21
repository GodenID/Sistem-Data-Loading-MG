const express = require('express');
const pool = require('../db');
const { notifyNewUpload } = require('../notify');

const router = express.Router();

// Zona waktu untuk agregasi per jam / "bulan ini" (server jalan di UTC)
const APP_TZ = process.env.APP_TIMEZONE || 'Asia/Jakarta';

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
    // Jumlah media dihitung di SQL (dulu: tarik baris lalu jumlahkan di JS dengan LIMIT 10000)
    const [total, loading, perawatan, media] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w1}`, v1),
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w2}`, v2),
      pool.query(`SELECT COUNT(*)::int AS c FROM loading_history_reports lh ${w3}`, v3),
      pool.query(`SELECT COALESCE(SUM(lh.photo_count), 0)::int AS c FROM loading_history_reports lh ${w4}`, v4),
    ]);
    res.json({
      total: total.rows[0].c,
      loading: loading.rows[0].c,
      perawatan: perawatan.rows[0].c,
      media: media.rows[0].c,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil summary' });
  }
});

// GET /api/history/heatmap?days=90
// Agregasi di SQL (dulu: tarik maks 5000 baris lalu hitung di JS -> terpotong saat data banyak)
router.get('/heatmap', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startStr = start.toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT date::text AS d, type, COUNT(*)::int AS cnt, COALESCE(SUM(photo_count), 0)::int AS media
       FROM loading_history_reports WHERE date >= $1
       GROUP BY date, type ORDER BY date ASC`,
      [startStr]
    );
    const map = {};
    let total = 0;
    rows.forEach((row) => {
      if (!map[row.d]) map[row.d] = { loading: 0, perawatan: 0, media: 0, total: 0 };
      const d = map[row.d];
      if (row.type === 'perawatan') d.perawatan += row.cnt;
      else d.loading += row.cnt;
      d.media += row.media;
      d.total += row.cnt;
      total += row.cnt;
    });
    res.json({ map, total, startStr });
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
// Mutlak: frontend memblokir submit jika duplicate=true (DB constraint UNIQUE
// sebagai pengaman terakhir). record dikembalikan untuk ditampilkan di modal.
router.get('/check-duplicate', async (req, res) => {
  try {
    const { companyId, date, type, excludeId } = req.query;
    if (!companyId || !date || !type) return res.status(400).json({ error: 'companyId, date, type wajib' });
    const values = [Number(companyId), date, type];
    let extra = '';
    if (excludeId) {
      values.push(Number(excludeId));
      extra = ` AND lh.id <> $${values.length}`;
    }
    const countR = await pool.query(
      `SELECT COUNT(*)::int AS c FROM loading_history_reports lh
       WHERE lh.company_id = $1 AND lh.date = $2 AND lh.type = $3${extra}`,
      values
    );
    let record = null;
    if (countR.rows[0].c > 0) {
      const rec = await pool.query(
        `SELECT lh.id, lh.company_id, lh.date, lh.pic, lh.type, lh.photo_count, lh.code, lh.created_at,
          c.name AS company_name
         FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id
         WHERE lh.company_id = $1 AND lh.date = $2 AND lh.type = $3${extra}
         ORDER BY lh.id ASC LIMIT 1`,
        values
      );
      if (rec.rows.length) {
        const r = rec.rows[0];
        record = {
          id: r.id, company_id: r.company_id, date: r.date, pic: r.pic,
          type: r.type, photo_count: r.photo_count, code: r.code,
          created_at: r.created_at, companyName: r.company_name || 'Unknown',
        };
      }
    }
    res.json({ duplicate: countR.rows[0].c > 0, record });
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
    values.push(limit);
    const { rows } = await pool.query(
      `SELECT lh.company_id, MAX(c.name) AS company_name,
              COUNT(*)::int AS upload_count, COALESCE(SUM(lh.photo_count), 0)::int AS total_photos
       FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id ${where}
       GROUP BY lh.company_id
       ORDER BY upload_count DESC, lh.company_id ASC
       LIMIT $${values.length}`,
      values
    );
    res.json(
      rows.map((r) => ({
        companyId: r.company_id,
        companyName: r.company_name || 'Unknown',
        uploadCount: r.upload_count,
        totalPhotos: r.total_photos,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil top uploaders' });
  }
});

// GET /api/history/hourly?from=&to=
// Jam dihitung di SQL pada zona waktu APP_TIMEZONE (default Asia/Jakarta);
// dulu pakai jam server (UTC) sehingga bergeser 7 jam.
router.get('/hourly', async (req, res) => {
  try {
    const values = [APP_TZ];
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
    const { rows } = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE $1)::int AS h, COUNT(*)::int AS c
       FROM loading_history_reports ${where} GROUP BY h`,
      values
    );
    const hours = new Array(24).fill(0);
    rows.forEach((r) => {
      hours[r.h] = r.c;
    });
    res.json(hours.map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, count })));
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil hourly' });
  }
});

// GET /api/history/overview — ringkasan dashboard admin dalam 1 request
// (dulu frontend menarik SELURUH history lalu menghitung sendiri).
router.get('/overview', async (_req, res) => {
  try {
    const [agg, recent] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE type = 'loading' OR type IS NULL)::int AS loading,
                COUNT(*) FILTER (WHERE type = 'perawatan')::int AS perawatan,
                COALESCE(SUM(photo_count), 0)::int AS media,
                COUNT(*) FILTER (WHERE date >= date_trunc('month', (NOW() AT TIME ZONE $1)::date)
                                   AND date < date_trunc('month', (NOW() AT TIME ZONE $1)::date) + INTERVAL '1 month')::int AS this_month,
                COUNT(DISTINCT company_id)::int AS active_clients
         FROM loading_history_reports`,
        [APP_TZ]
      ),
      pool.query(
        `SELECT lh.*, c.name AS company_name, c.sales_name AS company_sales, c.slug AS company_slug
         FROM loading_history_reports lh LEFT JOIN companies_reports c ON c.id = lh.company_id
         ORDER BY lh.created_at DESC LIMIT 5`
      ),
    ]);
    const a = agg.rows[0];
    res.json({
      total: a.total,
      loading: a.loading,
      perawatan: a.perawatan,
      media: a.media,
      thisMonth: a.this_month,
      activeClients: a.active_clients,
      recent: recent.rows.map(mapRow),
    });
  } catch (e) {
    console.error('GET /history/overview:', e.message);
    res.status(500).json({ error: 'Gagal ambil overview' });
  }
});

// GET /api/history/company-stats — jumlah dokumentasi & media per perusahaan
router.get('/company-stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT company_id, COUNT(*)::int AS rotation_count, COALESCE(SUM(photo_count), 0)::int AS total_photos
       FROM loading_history_reports GROUP BY company_id`
    );
    res.json(rows.map((r) => ({ companyId: r.company_id, rotationCount: r.rotation_count, totalPhotos: r.total_photos })));
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil statistik perusahaan' });
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
    // Serialisasi request kembar (double-tap / retry saat jaringan lemot) untuk
    // kombinasi perusahaan+tanggal+tipe yang sama. Lock otomatis lepas saat
    // COMMIT/ROLLBACK. Cek ini jalan walau constraint UNIQUE belum ada di DB.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${company_id}|${date}|${type}`]);
    const existing = await client.query(
      'SELECT 1 FROM loading_history_reports WHERE company_id = $1 AND date = $2 AND type = $3 LIMIT 1',
      [company_id, date, type]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: duplicateMessage(type), duplicate: true });
    }
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
    // Respon langsung — notifikasi Telegram jalan di belakang supaya response
    // tidak lambat (response lambat memicu klien timeout lalu kirim ulang).
    res.status(201).json(withCrew[0]);
    (async () => {
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
    })();
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
