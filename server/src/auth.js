const pool = require('./db');

// Tempel user ke req jika ada header Authorization: Bearer <token> yang valid.
// Diam (req.user = null) kalau tidak ada/invalid — biar read publik tetap jalan.
async function attachUser(req, _res, next) {
  req.user = null;
  const h = req.header('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) return next();
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE
       LIMIT 1`,
      [m[1]]
    );
    if (rows.length) req.user = rows[0];
  } catch (e) {
    console.warn('attachUser:', e.message);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Harus login dulu' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Harus login dulu' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin' });
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
