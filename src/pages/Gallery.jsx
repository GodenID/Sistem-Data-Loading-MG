import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Images, Search, X, Loader2, Video, ExternalLink,
} from 'lucide-react';
import { getGallery, getCompanies, getTeam } from '../utils/supabase';
import { getMediaTypeFromUrl } from '../utils/media';
import Lightbox from '../components/Lightbox';
import AppFooter from '../components/AppFooter';

const PAGE_SIZE = 60;

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Gallery = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [team, setTeam] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [filters, setFilters] = useState({
    companyId: 'all', type: 'all', crewUserId: 'all', dateFrom: '', dateTo: '',
  });
  const sentinelRef = useRef(null);

  const activeFilters = () => {
    const f = {};
    if (filters.companyId !== 'all') f.companyId = filters.companyId;
    if (filters.type !== 'all') f.type = filters.type;
    if (filters.crewUserId !== 'all') f.crewUserId = filters.crewUserId;
    if (filters.dateFrom) f.dateFrom = filters.dateFrom;
    if (filters.dateTo) f.dateTo = filters.dateTo;
    return f;
  };

  const loadPage = useCallback(async (p, append) => {
    const res = await getGallery(activeFilters(), { page: p, limit: PAGE_SIZE });
    const data = res.data || [];
    setItems((prev) => (append ? [...prev, ...data] : data));
    setTotal(res.count ?? 0);
    return data.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.companyId, filters.type, filters.crewUserId, filters.dateFrom, filters.dateTo]);

  // Reset saat filter berubah
  useEffect(() => {
    setPage(1);
    setLoading(true);
    loadPage(1, false).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.companyId, filters.type, filters.crewUserId, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    getCompanies().then(setCompanies).catch(() => {});
    getTeam().then(setTeam).catch(() => {});
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && items.length < total) {
          setLoadingMore(true);
          const next = page + 1;
          loadPage(next, true)
            .then(() => setPage(next))
            .finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, total, loading, loadingMore, page]);

  const hasFilter = filters.companyId !== 'all' || filters.type !== 'all' ||
    filters.crewUserId !== 'all' || filters.dateFrom || filters.dateTo;

  const clearFilters = () => setFilters({ companyId: 'all', type: 'all', crewUserId: 'all', dateFrom: '', dateTo: '' });

  const lightboxItems = items.map((p) => ({
    url: p.url,
    filename: p.filename,
    mediaType: getMediaTypeFromUrl(p.url, p.filename),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate flex items-center gap-2">
                <Images className="w-5 h-5 text-garden shrink-0" />
                Galeri
              </h1>
              <p className="text-xs text-gray-500">{total.toLocaleString('id-ID')} media</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium shrink-0 ${
                showFilters || hasFilter ? 'bg-garden text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              <select
                value={filters.companyId}
                onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-garden"
              >
                <option value="all">Semua perusahaan</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-garden"
              >
                <option value="all">Loading + Perawatan</option>
                <option value="loading">Loading</option>
                <option value="perawatan">Perawatan</option>
              </select>
              <select
                value={filters.crewUserId}
                onChange={(e) => setFilters({ ...filters, crewUserId: e.target.value })}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-garden"
              >
                <option value="all">Semua orang</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-garden"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-garden flex-1"
                />
                {hasFilter && (
                  <button onClick={clearFilters} className="p-2 rounded-xl bg-red-50 text-red-500" title="Hapus filter">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20">
        {loading ? (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="mb-3 break-inside-avoid rounded-xl bg-gray-200 animate-pulse" style={{ height: 140 + (i % 4) * 50 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Images className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Tidak ada media</p>
            <p className="text-sm text-gray-400">Ubah filter atau tambah dokumentasi baru</p>
          </div>
        ) : (
          <>
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
              {items.map((p, i) => {
                const isVideo = getMediaTypeFromUrl(p.url, p.filename) === 'video';
                return (
                  <div
                    key={p.id}
                    onClick={() => setLightboxIndex(i)}
                    className="relative mb-3 break-inside-avoid rounded-xl overflow-hidden bg-gray-100 cursor-pointer group"
                  >
                    {isVideo ? (
                      <video src={p.url} className="w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={p.url} alt={p.filename} loading="lazy" className="w-full object-cover" />
                    )}
                    {isVideo && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 flex items-center justify-center">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2">
                      <p className="text-white text-xs font-semibold truncate">{p.company_name || 'Unknown'}</p>
                      <p className="text-white/70 text-[11px] truncate">
                        {fmtDate(p.date)}{p.code ? ` • ${p.code}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={sentinelRef} className="py-6 text-center">
              {loadingMore && <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />}
              {!loadingMore && items.length >= total && total > 0 && (
                <p className="text-xs text-gray-400">Semua {total.toLocaleString('id-ID')} media tampil</p>
              )}
            </div>
          </>
        )}
      </main>

      {lightboxIndex !== null && (
        <Lightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
      <AppFooter />
    </div>
  );
};

export default Gallery;
