const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

const SESSION_DAYS = 30;
const PUBLIC_USER = 'SELECT id, username, name, role, is_active, must_change_password, created_at FROM users';

// Username dinormalisasi: kecil semua, tanpa spasi/karakter aneh.
// Mencegah kasus "tidak bisa login" karena typo tak terlihat / kapital.
function normalizeUsername(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

function validUsername(u) {
  return /^[a-z0-9._-]{3,32}$/.test(u);
}

// POST /api/auth/login { username, password }
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username & password wajib' });

    const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1) LIMIT 1', [
      String(username).trim(),
    ]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'Akun ini ditangguhkan, harap hubungi Goden' });
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Username atau password salah' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()', [user.id]);
    await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [
      user.id,
      token,
      expires,
    ]);

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, must_change_password: user.must_change_password },
    });
  } catch (e) {
    console.error('POST /auth/login:', e.message);
    res.status(500).json({ error: 'Gagal login' });
  }
});

// POST /api/auth/logout (hapus session sendiri)
router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    const m = /^Bearer\s+(.+)$/i.exec(req.header('authorization') || '');
    if (m) await pool.query('DELETE FROM sessions WHERE token = $1', [m[1]]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal logout' });
  }
});

// GET /api/auth/me
router.get('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Belum login' });
  res.json({ user: req.user });
});

// POST /api/auth/change-password { oldPassword?, newPassword }
// Wajib ganti saat must_change_password (login pertama / habis di-reset admin)
// — dalam kondisi itu password lama tidak perlu ditanya lagi.
router.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
    }
    const { rows } = await pool.query(
      'SELECT password_hash, must_change_password FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0].must_change_password) {
      const ok = await bcrypt.compare(String(oldPassword || ''), rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'Password lama salah' });
    }
    const hash = await bcrypt.hash(String(newPassword), 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
      [hash, req.user.id]
    );
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);
    // sesi baru untuk yang sedang login (biar tidak mental)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [
      req.user.id,
      token,
      expires,
    ]);
    res.json({ success: true, token });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ganti password' });
  }
});

// ---- USERS (admin) ----

// GET /api/users
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`${PUBLIC_USER} ORDER BY created_at ASC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil users' });
  }
});

// POST /api/users/bootstrap — buat admin PERTAMA, hanya jika tabel masih kosong.
// Setelah ada 1 user, endpoint ini mati (403) — pembuatan berikutnya via admin.
router.post('/users/bootstrap', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    if (rows[0].c > 0) return res.status(403).json({ error: 'Bootstrap sudah dipakai' });
    const { username, password, name } = req.body || {};
    const clean = normalizeUsername(username);
    if (!validUsername(clean) || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Username (huruf kecil, min 3) & password (min 6) wajib' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const r = await pool.query(
      'INSERT INTO users (username, password_hash, name, role, must_change_password) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username, name, role',
      [clean, hash, name || clean, 'admin']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai' });
    res.status(500).json({ error: 'Gagal buat admin pertama' });
  }
});

// POST /api/users (admin)
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role = 'staff' } = req.body || {};
    const clean = normalizeUsername(username);
    if (!validUsername(clean) || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Username (huruf kecil, min 3) & password (min 6) wajib' });
    }
    if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'Role harus admin/staff' });
    const dup = await pool.query('SELECT 1 FROM users WHERE lower(username) = $1 LIMIT 1', [clean]);
    if (dup.rows.length) return res.status(409).json({ error: 'Username sudah dipakai' });
    const hash = await bcrypt.hash(String(password), 10);
    const r = await pool.query(
      'INSERT INTO users (username, password_hash, name, role, must_change_password) VALUES ($1, $2, $3, $4, TRUE) RETURNING id, username, name, role, is_active, created_at',
      [clean, hash, name || clean, role]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai' });
    res.status(500).json({ error: 'Gagal tambah user' });
  }
});

// PATCH /api/users/:id (admin) — name, role, is_active, password
router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.role !== undefined) {
      if (!['admin', 'staff'].includes(req.body.role)) return res.status(400).json({ error: 'Role harus admin/staff' });
      data.role = req.body.role;
    }
    if (req.body.is_active !== undefined) data.is_active = !!req.body.is_active;
    if (req.body.password !== undefined) {
      if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Password min 6' });
      data.password_hash = await bcrypt.hash(String(req.body.password), 10);
      // Password di-reset admin -> user wajib ganti saat login berikut
      // (kecuali admin mengganti passwordnya sendiri)
      if (id !== req.user.id) data.must_change_password = true;
    }
    // Admin tidak boleh menurunkan/mematikan dirinya sendiri
    if (id === req.user.id && (data.role === 'staff' || data.is_active === false)) {
      return res.status(400).json({ error: 'Tidak bisa ubah role/status diri sendiri' });
    }
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ error: 'Tidak ada field valid' });
    // Jangan sampai admin terakhir hilang
    if (data.role === 'staff' || data.is_active === false) {
      const c = await pool.query(
        "SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> $1",
        [id]
      );
      if (c.rows[0].c < 1) return res.status(400).json({ error: 'Minimal harus ada 1 admin aktif' });
    }
    const set = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const r = await pool.query(
      `UPDATE users SET ${set}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING id, username, name, role, is_active, created_at`,
      [...cols.map((k) => data[k]), id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Gagal update user' });
  }
});

// DELETE /api/users/:id (admin) — tidak bisa hapus diri sendiri / admin terakhir
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'Tidak bisa hapus diri sendiri' });
    const linked = await pool.query('SELECT COUNT(*)::int AS c FROM history_crew WHERE user_id = $1', [id]);
    if (linked.rows[0].c > 0) {
      return res.status(400).json({ error: 'User punya riwayat tim — nonaktifkan saja, jangan hapus' });
    }    const target = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (!target.rows.length) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (target.rows[0].role === 'admin') {
      const c = await pool.query(
        "SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> $1",
        [id]
      );
      if (c.rows[0].c < 1) return res.status(400).json({ error: 'Minimal harus ada 1 admin aktif' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal hapus user' });
  }
});

module.exports = router;
