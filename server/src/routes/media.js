// GET /api/media/download?src=<url-S3>&filename=001.jpg
//
// Proxy download agar tidak kena CORS bucket: server ambil dari S3,
// browser ambil dari API (CORS API sudah dibuka untuk frontend).
// Hanya melayani URL dari bucket S3 sendiri (cegah jadi proxy bebas).
const express = require('express');
const { keyFromUrl } = require('../s3');

const router = express.Router();

router.get('/download', async (req, res) => {
  try {
    const src = req.query.src;
    if (!src) return res.status(400).json({ error: 'src wajib' });
    const origKey = keyFromUrl(src);
    if (!origKey) return res.status(400).json({ error: 'URL bukan file S3 kami' });

    const filename = String(req.query.filename || origKey.split('/').pop() || 'file')
      .replace(/["\\\r\n]/g, '')
      .slice(0, 120);

    const lib = src.startsWith('https') ? require('https') : require('http');
    lib
      .get(src, (upstream) => {
        if (upstream.statusCode !== 200) {
          upstream.resume();
          return res.status(502).json({ error: 'Gagal ambil file dari S3' });
        }
        res.set('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
        if (upstream.headers['content-length']) {
          res.set('Content-Length', upstream.headers['content-length']);
        }
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.set('Cache-Control', 'private, max-age=3600');
        upstream.pipe(res);
      })
      .on('error', (e) => {
        console.warn('Download proxy gagal:', e.message);
        if (!res.headersSent) res.status(502).json({ error: 'Gagal download file' });
      });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'Gagal download file' });
  }
});

module.exports = router;
