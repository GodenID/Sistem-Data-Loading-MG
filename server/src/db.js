require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum di-set! Lihat server/.env.example');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
