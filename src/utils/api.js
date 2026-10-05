// REST client untuk backend Coolify (pengganti supabase-js).
// Base URL di-set via VITE_API_URL, contoh: https://api-projectpg.prasastigroup.id

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

if (!BASE) {
  console.error('VITE_API_URL belum di-set! Lihat .env.example');
}

function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, query } = {}) {
  const url = `${BASE}${path}${buildQuery(query)}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Tidak bisa hubungi API (${method} ${path}): ${e.message}`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `API error ${res.status} (${method} ${path})`);
  }
  return data;
}

export const apiGet = (path, query) => request(path, { query });
export const apiPost = (path, body, query) => request(path, { method: 'POST', body, query });
export const apiPatch = (path, body, query) => request(path, { method: 'PATCH', body, query });
export const apiPut = (path, body, query) => request(path, { method: 'PUT', body, query });
export const apiDelete = (path, query) => request(path, { method: 'DELETE', query });

export const API_BASE = BASE;
