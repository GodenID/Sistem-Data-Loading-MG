const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/upload-stats?from=&to=
router.get('/', async (req, res) => {
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
    const { rows } = await pool.query(`SELECT * FROM upload_stats ${where} ORDER BY date ASC`, values);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil upload stats' });
  }
});

// GET /api/upload-stats/summary?from=&to=
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from & to wajib' });
    const { rows } = await pool.query('SELECT * FROM upload_stats WHERE date >= $1 AND date <= $2', [from, to]);
    const acc = {
      totalUploads: 0, successfulUploads: 0, failedUploads: 0,
      totalPhotos: 0, totalSizeBytes: 0, ratios: [],
    };
    rows.forEach((s) => {
      acc.totalUploads += s.total_uploads || 0;
      acc.successfulUploads += s.successful_uploads || 0;
      acc.failedUploads += s.failed_uploads || 0;
      acc.totalPhotos += s.total_photos || 0;
      acc.totalSizeBytes += Number(s.total_size_bytes) || 0;
      if (s.avg_compression_ratio != null) acc.ratios.push(Number(s.avg_compression_ratio));
    });
    const avgCompressionRatio = acc.ratios.length
      ? acc.ratios.reduce((a, b) => a + b, 0) / acc.ratios.length : 0;
    const successRate = acc.totalUploads > 0
      ? Number(((acc.successfulUploads / acc.totalUploads) * 100).toFixed(2)) : 0;
    res.json({
      totalUploads: acc.totalUploads,
      successfulUploads: acc.successfulUploads,
      failedUploads: acc.failedUploads,
      totalPhotos: acc.totalPhotos,
      totalSizeBytes: acc.totalSizeBytes,
      avgCompressionRatio,
      successRate,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil summary' });
  }
});

// POST /api/upload-stats/track { success, photoCount, totalSize, compressionRatio }
router.post('/track', async (req, res) => {
  try {
    const { success, photoCount = 0, totalSize = 0, compressionRatio = null } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query('SELECT * FROM upload_stats WHERE date = $1 LIMIT 1', [today]);
    if (rows.length) {
      const ex = rows[0];
      await pool.query(
        `UPDATE upload_stats SET total_uploads = $1, successful_uploads = $2, failed_uploads = $3,
         total_photos = $4, total_size_bytes = $5, updated_at = NOW() WHERE id = $6`,
        [
          ex.total_uploads + 1,
          ex.successful_uploads + (success ? 1 : 0),
          ex.failed_uploads + (success ? 0 : 1),
          ex.total_photos + (photoCount || 0),
          Number(ex.total_size_bytes) + (totalSize || 0),
          ex.id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO upload_stats (date, total_uploads, successful_uploads, failed_uploads, total_photos, total_size_bytes, avg_compression_ratio)
         VALUES ($1,1,$2,$3,$4,$5,$6)`,
        [today, success ? 1 : 0, success ? 0 : 1, photoCount || 0, totalSize || 0, compressionRatio]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal track upload' });
  }
});

// GET /api/upload-stats/error-rate?from=&to=
router.get('/error-rate', async (req, res) => {
  try {
    const { from, to } = req.query;
    const [errs, ups] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM error_logs WHERE created_at >= $1 AND created_at <= $2`,
        [`${from}T00:00:00Z`, `${to}T23:59:59Z`]
      ),
      pool.query('SELECT total_uploads FROM upload_stats WHERE date >= $1 AND date <= $2', [from, to]),
    ]);
    const totalErrors = errs.rows[0].c;
    const totalUploads = ups.rows.reduce((a, r) => a + (r.total_uploads || 0), 0);
    const errorRate = totalUploads > 0 ? Number(((totalErrors / totalUploads) * 100).toFixed(2)) : 0;
    res.json({ errorRate, totalErrors, totalUploads });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hitung error rate' });
  }
});

// ---- ERROR LOGS ----

// POST /api/errors
router.post('/errors', async (req, res) => {
  try {
    const { type = 'other', message, company_id = null, history_id = null, context = {}, user_agent = null } = req.body;
    await pool.query(
      'INSERT INTO error_logs (error_type, error_message, company_id, history_id, context, user_agent) VALUES ($1,$2,$3,$4,$5,$6)',
      [type, message, company_id, history_id, context, user_agent]
    );
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal log error' });
  }
});

// GET /api/errors/stats?from=&to=&type=
router.get('/errors/stats', async (req, res) => {
  try {
    const values = [];
    const conds = [];
    if (req.query.from) {
      values.push(`${req.query.from}T00:00:00Z`);
      conds.push(`created_at >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(`${req.query.to}T23:59:59Z`);
      conds.push(`created_at <= $${values.length}`);
    }
    if (req.query.type) {
      values.push(req.query.type);
      conds.push(`error_type = $${values.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM error_logs ${where}`, values);
    const byType = {};
    const trendMap = {};
    let unresolved = 0;
    rows.forEach((err) => {
      byType[err.error_type] = (byType[err.error_type] || 0) + 1;
      const d = new Date(err.created_at).toISOString().split('T')[0];
      trendMap[d] = (trendMap[d] || 0) + 1;
      if (!err.resolved) unresolved += 1;
    });
    const trend = Object.entries(trendMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    res.json({ total: rows.length, byType, trend, unresolved });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil error stats' });
  }
});

// GET /api/errors/recent?limit=&unresolvedOnly=
router.get('/errors/recent', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const values = [limit];
    let where = '';
    if (req.query.unresolvedOnly === 'true') where = 'WHERE e.resolved = false';
    const { rows } = await pool.query(
      `SELECT e.*, c.name AS company_name FROM error_logs e LEFT JOIN companies_reports c ON c.id = e.company_id
       ${where} ORDER BY e.created_at DESC LIMIT $1`,
      values
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil recent errors' });
  }
});

// PATCH /api/errors/:id/resolve
router.patch('/errors/:id/resolve', async (req, res) => {
  try {
    await pool.query('UPDATE error_logs SET resolved = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal resolve error' });
  }
});

module.exports = router;
