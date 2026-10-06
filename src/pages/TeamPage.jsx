import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trophy, Medal, Loader2, ChevronDown, Calendar, Image, User as UserIcon,
} from 'lucide-react';
import { getTeamStats, getMemberHistory } from '../utils/supabase';
import AppFooter from '../components/AppFooter';

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MemberRow = ({ m, rank, expanded, onToggle }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !history) {
      setLoading(true);
      getMemberHistory(m.id, 10)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const medal = rank === 1
    ? <Trophy className="w-5 h-5 text-amber-500" />
    : rank <= 3
      ? <Medal className="w-5 h-5 text-gray-400" />
      : <span className="w-5 text-center text-sm font-bold text-gray-400">{rank}</span>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50"
      >
        <div className="w-8 flex justify-center shrink-0">{medal}</div>
        <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5 text-garden" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {m.name || m.username}
            {!m.is_active && <span className="text-xs text-red-500 font-normal"> • nonaktif</span>}
          </p>
          <p className="text-xs text-gray-500">
            {m.total} dokumentasi ({m.loading} loading, {m.perawatan} perawatan) • {m.media} media
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-xs text-gray-400">Terakhir aktif</p>
          <p className="text-sm font-medium text-gray-700">{fmtDate(m.last_date)}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          {loading ? (
            <div className="py-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Belum ada dokumentasi.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm bg-white rounded-xl border border-gray-100 px-3 py-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.type === 'perawatan' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {h.type === 'perawatan' ? 'RAWAT' : 'LOAD'}
                  </span>
                  {h.code && (
                    <span className="text-[10px] font-mono font-semibold text-gray-500 shrink-0">{h.code}</span>
                  )}
                  <span className="flex-1 truncate text-gray-800">{h.companyName}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3" />{fmtDate(h.date)}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                    <Image className="w-3 h-3" />{h.photo_count || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TeamPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    getTeamStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-3 py-3 sm:px-4 sm:py-4 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Performa Tim</h1>
            <p className="text-xs text-gray-500">Terhitung mulai 6 Okt 2026 • siapa loading berapa kali</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : stats.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Belum ada data tim.</p>
        ) : (
          <div className="space-y-3">
            {stats.map((m, i) => (
              <MemberRow
                key={m.id}
                m={m}
                rank={i + 1}
                expanded={expandedId === m.id}
                onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              />
            ))}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
};

export default TeamPage;
