// Notifikasi Telegram tiap dokumentasi baru (loading/perawatan).
// Token & chat diset via env — tidak pernah di frontend (rahasia).
// Gagal kirim tidak boleh menggagalkan request (silent warn).

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

function enabled() {
  return !!(BOT_TOKEN && CHAT_ID);
}

function formatDateID(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

async function sendTelegram(text) {
  if (!enabled()) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });
    if (!res.ok) {
      console.warn('Telegram gagal:', await res.text().catch(() => res.status));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Telegram error:', e.message);
    return false;
  }
}

// history = row loading_history_reports, company = {name, slug}, crewNames = [..]
async function notifyNewUpload(history, company, crewNames = []) {
  if (!enabled()) return false;
  const isRawat = history.type === 'perawatan';
  const lines = [
    `${isRawat ? '🧹' : '🌿'} ${isRawat ? 'Perawatan' : 'Loading'} baru — ${company?.name || 'Unknown'}`,
  ];
  if (history.code) lines.push(`🔖 ${history.code}`);
  lines.push(`📅 ${formatDateID(history.date)} • Oleh: ${history.pic || '-'}`);
  if (crewNames.length) lines.push(`👥 Tim: ${crewNames.join(', ')}`);
  lines.push(`📷 ${history.photo_count || 0} media`);
  if (history.catatan) lines.push(`📝 ${String(history.catatan).slice(0, 200)}`);
  if (FRONTEND_URL && company?.slug) {
    lines.push(`🔗 ${FRONTEND_URL}/client/${company.slug}`);
  }
  return sendTelegram(lines.join('\n'));
}

module.exports = { enabled, sendTelegram, notifyNewUpload };
