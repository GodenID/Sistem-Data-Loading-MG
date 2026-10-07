require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const companiesRouter = require('./routes/companies');
const historyRouter = require('./routes/history');
const photosRouter = require('./routes/photos');
const shareRouter = require('./routes/shareLinks');
const statsRouter = require('./routes/stats');
const authRouter = require('./routes/auth');
const teamRouter = require('./routes/team');
const mediaRouter = require('./routes/media');
const { attachUser } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: izinkan frontend Cloudflare + lokal
const allowed = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / healthcheck
      if (!allowed.length || allowed.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', error: e.message });
  }
});

app.use('/api', attachUser);

// Aturan akses: baca (GET) + portal share-link tetap publik tanpa login.
// Tulis (POST/PATCH/PUT) wajib login, hapus (DELETE) wajib admin.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/auth/login' || req.path === '/users/bootstrap') return next();
  if (/^\/(company-)?share-links\/token\/.+\/access$/.test(req.path)) return next();
  if (!req.user) return res.status(401).json({ error: 'Harus login dulu' });
  if (req.method === 'DELETE' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya admin yang boleh menghapus' });
  }
  next();
});

app.use('/api/companies', companiesRouter);
app.use('/api/history', historyRouter);
app.use('/api/photos', photosRouter);
app.use('/api', shareRouter);
app.use('/api/upload-stats', statsRouter);
app.use('/api', authRouter);
app.use('/api/team', teamRouter);
app.use('/api/media', mediaRouter);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`MG Report API jalan di port ${PORT}`);
});
