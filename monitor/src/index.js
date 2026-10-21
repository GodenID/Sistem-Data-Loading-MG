// Uptime monitor MG Report — Cloudflare Worker (cron tiap menit).
// Cek API (/health = termasuk koneksi database) dan frontend; kirim alert
// Telegram saat down (setelah FAIL_THRESHOLD kali gagal berturut-turut) dan
// saat pulih. Berjalan di luar VPS, jadi tetap bisa melapor kalau VPS mati.
//
// State di KV (binding STATE) — hanya DITULIS saat ada perubahan, bukan tiap menit.

const CHECK_TIMEOUT_MS = 8000;
const SLOW_MS = 4000; // lebih lambat dari ini dicatat sebagai peringatan "lambat" (tidak alert)

function targets(env) {
  return [
    {
      key: 'api',
      name: 'API & Database',
      url: `${env.API_URL}/health`,
      async validate(res) {
        const body = await res.json().catch(() => null);
        if (body?.db === 'down') return `database tidak terjangkau${body.error ? ` (${body.error})` : ''}`;
        if (!res.ok) return `HTTP ${res.status}`;
        if (!body?.ok || body.db !== 'up') return 'respons /health tidak valid';
        return null;
      },
    },
    {
      key: 'web',
      name: 'Frontend',
      url: env.WEB_URL,
      async validate(res) {
        return res.ok ? null : `HTTP ${res.status}`;
      },
    },
  ];
}

async function probe(target) {
  const t0 = Date.now();
  try {
    const res = await fetch(target.url, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { 'cache-control': 'no-cache', 'user-agent': 'mg-uptime-monitor' },
      cf: { cacheTtl: 0 },
    });
    const problem = await target.validate(res);
    return { ok: !problem, reason: problem, ms: Date.now() - t0 };
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { ok: false, reason: timedOut ? `timeout > ${CHECK_TIMEOUT_MS / 1000}s` : `tidak terjangkau (${e?.message || 'error'})`, ms: Date.now() - t0 };
  }
}

const fmtWib = (ms) =>
  new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';

const fmtDuration = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60} menit`;
};

async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram belum dikonfigurasi, alert hanya di log:', text);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) console.warn('Telegram gagal:', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.warn('Telegram error:', e?.message);
    return false;
  }
}

async function checkOne(env, target) {
  const threshold = Math.max(1, parseInt(env.FAIL_THRESHOLD, 10) || 2);
  const stored = (await env.STATE.get(target.key, 'json')) || { status: 'up', fails: 0, since: Date.now() };
  const result = await probe(target);
  const now = Date.now();

  if (result.ok) {
    if (stored.status === 'down') {
      // Pulih
      await sendTelegram(
        env,
        `🟢 ${target.name} PULIH\nDown selama ${fmtDuration(now - stored.since)} (sejak ${fmtWib(stored.since)})\nRespons: ${result.ms} ms`
      );
      await env.STATE.put(target.key, JSON.stringify({ status: 'up', fails: 0, since: now, lastMs: result.ms }));
    } else if (stored.fails > 0) {
      // Gagal sesaat (di bawah ambang) lalu normal lagi -> reset penghitung
      await env.STATE.put(target.key, JSON.stringify({ status: 'up', fails: 0, since: stored.since, lastMs: result.ms }));
    }
    if (result.ms > SLOW_MS) console.warn(`${target.name} lambat: ${result.ms} ms`);
    return { target: target.key, ok: true, ms: result.ms };
  }

  const fails = (stored.fails || 0) + 1;
  if (stored.status === 'up' && fails >= threshold) {
    await sendTelegram(
      env,
      `🔴 ${target.name} DOWN\nAlasan: ${result.reason}\nTerdeteksi: ${fmtWib(now)} (${fails}x cek gagal berturut-turut)\n${target.url}`
    );
    await env.STATE.put(target.key, JSON.stringify({ status: 'down', fails, since: now, reason: result.reason }));
  } else if (stored.status === 'up') {
    await env.STATE.put(target.key, JSON.stringify({ status: 'up', fails, since: stored.since, reason: result.reason }));
  } else if (now - (stored.lastReminder || stored.since) >= 30 * 60 * 1000) {
    // Masih down: ingatkan tiap 30 menit. (Tidak menulis KV tiap menit selama down.)
    await sendTelegram(env, `🔴 ${target.name} MASIH DOWN sejak ${fmtWib(stored.since)} (${fmtDuration(now - stored.since)})\nAlasan: ${result.reason}`);
    await env.STATE.put(target.key, JSON.stringify({ ...stored, lastReminder: now }));
  }
  return { target: target.key, ok: false, reason: result.reason, ms: result.ms };
}

async function runChecks(env) {
  const results = await Promise.all(targets(env).map((t) => checkOne(env, t)));
  // Heartbeat tiap ~10 menit (bukan tiap menit, hemat kuota tulis KV) supaya
  // /status membuktikan monitor sendiri masih jalan.
  const hb = await env.STATE.get('heartbeat', 'json');
  if (!hb || Date.now() - hb.at >= 10 * 60 * 1000) {
    await env.STATE.put('heartbeat', JSON.stringify({ at: Date.now(), results }));
  }
  return results;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runChecks(env).catch(async (e) => {
        console.error('monitor error:', e?.stack || e);
        try {
          await env.STATE.put('lasterror', JSON.stringify({ at: Date.now(), message: String(e?.message || e) }));
        } catch { /* abaikan */ }
      })
    );
  },

  // GET /status -> keadaan terakhir (tanpa memicu alert). Tidak berisi rahasia.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/status') return new Response('mg-uptime-monitor', { status: 200 });
    const out = {};
    for (const t of targets(env)) out[t.key] = (await env.STATE.get(t.key, 'json')) || { status: 'unknown' };
    out.heartbeat = (await env.STATE.get('heartbeat', 'json')) || null;
    const lasterror = await env.STATE.get('lasterror', 'json');
    if (lasterror) out.lasterror = lasterror;
    return Response.json(out, { headers: { 'cache-control': 'no-store' } });
  },
};
