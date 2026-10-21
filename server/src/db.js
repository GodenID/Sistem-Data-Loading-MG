require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum di-set! Lihat server/.env.example');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Jangan menggantung selamanya kalau DB tidak terjangkau (request cepat gagal,
  // health check bisa melapor down).
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
