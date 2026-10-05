import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Shield, Users, Package, Image, Clock, RotateCcw, Sparkles, User, CheckCircle2, ChevronLeft, ChevronRight, Calendar, MapPin, Activity } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import CompanyCard from '../components/CompanyCard';
import PullIndicator from '../components/PullIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import Skeleton from '../components/Skeleton';
import AnimatedCounter from '../components/AnimatedCounter';
import { getCompanies, getCompaniesCount, getActiveCompanyIds, getLoadingHistory, getLoadingHistorySummary, getActivityHeatmap } from '../utils/supabase';
import { createSlug } from '../utils/slug';
import { APP_VERSION } from '../utils/version';

const ROTATION_PER_PAGE = 50;
const SEARCH_LIMIT = 20;
const HEATMAP_DAYS = 90;

// Skala hijau garden untuk heatmap (0 = kosong)
const HEAT_COLORS = ['#e8ecef', '#c8e6c9', '#81c784', '#43a047', '#2e7d32'];
const heatLevel = (count) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

// YYYY-MM-DD lokal (hindari geser hari oleh toISOString/UTC)
const toLocalISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Batas "aktif": ada dokumentasi dalam 2 bulan terakhir (format YYYY-MM-DD)
const twoMonthsAgoStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().split('T')[0];
};

const Home = () => {
  const navigate = useNavigate();
  // Gembok password home sudah dihapus (auth beneran via login).
  // isAuthenticated dipertahankan sebagai true agar logika fetch tidak berubah.
  const [isAuthenticated] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIds, setActiveIds] = useState(new Set());
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalHistory: 0,
    totalPhotos: 0
  });

  // Rotasi: hanya halaman aktif yang dimuat (server-side, bukan full-table)
  const [rotationItems, setRotationItems] = useState([]);
  const [rotationTotal, setRotationTotal] = useState(0);
  const [rotationSummary, setRotationSummary] = useState({ total: 0, loading: 0, perawatan: 0, media: 0 });
  const [rotationPage, setRotationPage] = useState(1);
  const [rotationLoading, setRotationLoading] = useState(true);
  const [rotationLoadingMore, setRotationLoadingMore] = useState(false);

  // Heatmap 90 hari: { map: {YYYY-MM-DD: {loading, perawatan, media, total}}, total }
  const [heatmap, setHeatmap] = useState(null);

  // State untuk rentang tanggal (date range)
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Format tanggal untuk display
  const formatDateDisplay = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Cek apakah rentang tanggal adalah hari ini saja
  const isTodayRange = () => {
    return startDate === today && endDate === today;
  };

  // Preset rentang tanggal
  const setToday = () => {
    setStartDate(today);
    setEndDate(today);
  };

  const setLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  // Group item rotasi halaman aktif per tanggal (server sudah urut date desc)
  const groupedRotation = useMemo(() => {
    const grouped = {};
    rotationItems.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });
    return {
      grouped,
      sortedDates: Object.keys(grouped).sort((a, b) => b.localeCompare(a))
    };
  }, [rotationItems]);

  // Grid heatmap: kolom = minggu (Senin-Minggu), sel = hari.
  // Klik sel -> rotasi difilter ke tanggal itu.
  const heatmapGrid = useMemo(() => {
    if (!heatmap) return { weeks: [], monthLabels: {} };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - (HEATMAP_DAYS - 1));
    const windowStartStr = toLocalISO(windowStart);

    // Mundur ke Senin agar kolom rapi
    const gridStart = new Date(windowStart);
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));

    const cells = [];
    for (let d = new Date(gridStart); d <= today; d.setDate(d.getDate() + 1)) {
      const iso = toLocalISO(d);
      const inWindow = iso >= windowStartStr;
      const entry = inWindow ? heatmap.map[iso] : null;
      cells.push({
        date: iso,
        inWindow,
        total: entry?.total || 0,
        loading: entry?.loading || 0,
        perawatan: entry?.perawatan || 0,
        media: entry?.media || 0,
      });
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Label bulan di kolom pertama tiap bulan berganti
    const monthLabels = {};
    weeks.forEach((week, wi) => {
      const first = week.find(c => c.inWindow);
      if (!first) return;
      const label = new Date(first.date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' });
      const prevFirst = wi > 0 ? weeks[wi - 1].find(c => c.inWindow) : null;
      const prevLabel = prevFirst
        ? new Date(prevFirst.date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' })
        : null;
      if (label !== prevLabel) monthLabels[wi] = label;
    });

    return { weeks, monthLabels };
  }, [heatmap]);

  const selectedHeatDay = startDate === endDate ? startDate : null;

  // Handle click pada item rotasi untuk menuju detail client
  const handleRotationClick = (item) => {
    const slug = item.companySlug || createSlug(item.companyName);
    navigate(`/client/${slug}`);
  };

  // (Cek session saat mount tidak diperlukan lagi — sudah di initializer di atas)

  // Statistik atas: count ringan, tanpa fetch full-table
  const fetchStats = async () => {
    if (!isAuthenticated) return;
    try {
      setStatsLoading(true);
      const [companiesCount, summary] = await Promise.all([
        getCompaniesCount(),
        getLoadingHistorySummary({})
      ]);
      setStats({
        totalCompanies: companiesCount,
        totalHistory: summary.total,
        totalPhotos: summary.media
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Pencarian perusahaan ke server (max 20, hanya setelah mengetik)
  const fetchSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      setActiveIds(new Set());
      return;
    }
    try {
      setSearchLoading(true);
      const { data, count } = await getCompanies({ search: query, page: 1, limit: SEARCH_LIMIT });
      setSearchResults(data || []);
      setSearchTotal(count ?? 0);
      // Badge aktif: cek ada dokumentasi 2 bulan terakhir utk hasil tampil saja
      const ids = (data || []).map(c => c.id);
      const active = await getActiveCompanyIds(ids, twoMonthsAgoStr());
      setActiveIds(new Set(active));
    } catch (error) {
      console.error('Error searching companies:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Rotasi per rentang tanggal: halaman 1 + ringkasan counter dari server
  const fetchRotation = async (page = 1, append = false) => {
    if (!isAuthenticated) return;
    try {
      if (append) setRotationLoadingMore(true);
      else setRotationLoading(true);
      const filters = { dateFrom: startDate, dateTo: endDate, sortBy: 'date', sortDir: 'desc' };
      const [{ data, count }, summary] = await Promise.all([
        getLoadingHistory(filters, { page, limit: ROTATION_PER_PAGE }),
        append ? null : getLoadingHistorySummary({ dateFrom: startDate, dateTo: endDate })
      ]);
      setRotationItems(prev => append ? [...prev, ...(data || [])] : (data || []));
      setRotationTotal(count ?? 0);
      if (summary) setRotationSummary(summary);
      setRotationPage(page);
    } catch (error) {
      console.error('Error fetching rotation:', error);
    } finally {
      setRotationLoading(false);
      setRotationLoadingMore(false);
    }
  };

  const fetchAll = () => {
    fetchStats();
    fetchRotation(1);
    fetchHeatmap();
    if (searchQuery.trim()) fetchSearch(searchQuery);
  };

  // Heatmap: agregasi ringan, gagal -> kartu disembunyikan diam-diam
  const fetchHeatmap = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getActivityHeatmap(HEATMAP_DAYS);
      setHeatmap(data);
    } catch (error) {
      console.warn('Gagal memuat heatmap:', error?.message);
      setHeatmap(null);
    }
  };

  // Tarik ke bawah (HP) untuk refresh + auto-refresh saat upload background selesai
  const { pull, refreshing } = usePullToRefresh(() => fetchAll(), isAuthenticated);

  useEffect(() => {
    const handleUploadDone = () => fetchAll();
    window.addEventListener('mg-upload-done', handleUploadDone);
    return () => window.removeEventListener('mg-upload-done', handleUploadDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchStats();
    fetchRotation(1);
    fetchHeatmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Debounce ketikan pencarian 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isAuthenticated]);

  // Ganti rentang tanggal -> muat ulang halaman 1
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRotation(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Refresh data when window regains focus (user returns from admin)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, searchQuery, startDate, endDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-garden-light/30">
      <PullIndicator pull={pull} refreshing={refreshing} />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-14 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Mutiari Garden</h1>
                <p className="text-xs text-gray-500">Report Dokumentasi</p>
              </div>
            </div>
            <a
              href="#/admin/login"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/admin/login';
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalCompanies} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Perusahaan</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center mx-auto mb-2">
              <Package className="w-5 h-5 text-garden" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalHistory} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Dokumentasi</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2">
              <Image className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalPhotos} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Media</p>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Cari Data Perusahaan
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base">
            Masukkan nama perusahaan untuk melihat detail dan menginput data loading
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-6 sm:mb-8">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Ketik nama perusahaan..."
          />
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {!searchInput.trim() ? (
            // Empty State - No search yet
            <div className="text-center py-12 sm:py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">Mulai ketik untuk mencari perusahaan</p>
            </div>
          ) : searchLoading && searchResults.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton.Card key={i} />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            // No Results State
            <div className="text-center py-12 sm:py-16">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-red-300" />
              </div>
              <p className="text-gray-500 font-medium mb-1">Tidak ada hasil</p>
              <p className="text-sm text-gray-400">
                Coba kata kunci lain atau periksa ejaan
              </p>
            </div>
          ) : (
            // Results List
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-gray-500">
                  Ditemukan <span className="font-semibold text-gray-700">{searchTotal}</span> perusahaan
                  {searchTotal > searchResults.length && (
                    <span className="text-gray-400"> (menampilkan {searchResults.length}, persempit kata kunci)</span>
                  )}
                </p>
              </div>
              <div className="space-y-3">
                {searchResults.map((company, index) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    index={index}
                    isActive={activeIds.has(company.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tracking Rotasi Section */}
        {!searchInput.trim() && (
          <div className="mt-8">
            {/* Heatmap Aktivitas 90 hari */}
            {heatmap && heatmapGrid.weeks.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-garden" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Heatmap Aktivitas</h3>
                    <p className="text-xs text-gray-500">
                      {HEATMAP_DAYS} hari terakhir • {heatmap.total} dokumentasi • ketuk tanggal untuk lihat rotasi
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto no-scrollbar mt-3">
                  <div className="inline-block min-w-full">
                    {/* Label bulan */}
                    <div className="flex gap-[3px] mb-1 ml-0">
                      {heatmapGrid.weeks.map((_, wi) => (
                        <span key={wi} className="w-3 sm:w-3.5 shrink-0 text-[9px] text-gray-400 leading-none h-3">
                          {heatmapGrid.monthLabels[wi] || ''}
                        </span>
                      ))}
                    </div>
                    {/* Grid minggu x hari */}
                    <div className="flex gap-[3px]">
                      {heatmapGrid.weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {week.map((cell) => {
                            const isSelected = selectedHeatDay === cell.date;
                            const label = new Date(cell.date + 'T00:00:00').toLocaleDateString('id-ID', {
                              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                            });
                            return (
                              <button
                                key={cell.date}
                                disabled={!cell.inWindow}
                                title={cell.inWindow
                                  ? `${label}: ${cell.total} dokumentasi (${cell.loading} loading, ${cell.perawatan} perawatan, ${cell.media} media)`
                                  : ''}
                                onClick={() => { setStartDate(cell.date); setEndDate(cell.date); }}
                                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] transition-transform hover:scale-125 active:scale-95 ${
                                  isSelected ? 'ring-2 ring-gray-900 ring-offset-1' : ''
                                } ${cell.inWindow ? '' : 'invisible'}`}
                                style={{ backgroundColor: HEAT_COLORS[heatLevel(cell.total)] }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Legenda */}
                <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-gray-400">
                  <span>Sedikit</span>
                  {HEAT_COLORS.map((c) => (
                    <span key={c} className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: c }} />
                  ))}
                  <span>Banyak</span>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-garden/5 to-blue-50 rounded-2xl shadow-sm border border-garden/20 overflow-hidden">
              <div className="p-5 border-b border-garden/10 bg-white/50">
                {/* Header dengan Date Range */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-garden flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        Tracking Rotasi {isTodayRange() ? 'Hari Ini' : ''}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatDateDisplay(startDate)} {startDate !== endDate && ` - ${formatDateDisplay(endDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-garden">
                      {rotationTotal}
                    </span>
                    <span className="text-sm text-gray-500">rotasi</span>
                  </div>
                </div>

                {/* Date Range Picker Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-garden/10">
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={setToday}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isTodayRange()
                          ? 'bg-garden text-white'
                          : 'bg-white border border-garden/20 text-garden hover:bg-garden/10'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      onClick={setLast7Days}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      7 Hari
                    </button>
                    <button
                      onClick={setLast30Days}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      30 Hari
                    </button>
                    <button
                      onClick={setThisMonth}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      Bulan Ini
                    </button>
                  </div>
                  
                  {/* Date Inputs */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate}
                      className="px-2 py-1.5 rounded-lg border border-garden/20 text-xs focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white w-28"
                    />
                    <span className="text-gray-400 text-xs">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="px-2 py-1.5 rounded-lg border border-garden/20 text-xs focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white w-28"
                    />
                  </div>
                </div>
              </div>

              {/* Date Range Stats (counter dari server, bukan full-table) */}
              <>
                    <div className="grid grid-cols-3 gap-4 p-4 bg-white/30">
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-garden/10">
                        <p className="text-2xl font-bold text-garden">{rotationSummary.loading}</p>
                        <p className="text-xs text-gray-500">Loading</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-blue-200">
                        <p className="text-2xl font-bold text-blue-600">{rotationSummary.perawatan}</p>
                        <p className="text-xs text-gray-500">Perawatan</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-orange-200">
                        <p className="text-2xl font-bold text-orange-600">{rotationSummary.media}</p>
                <p className="text-xs text-gray-500">Total Media</p>
                      </div>
                    </div>

                    {/* Date Range Rotation List - Grouped by Date */}
                    <div className="divide-y divide-garden/10 max-h-[500px] overflow-y-auto">
                      {rotationLoading ? (
                        <div className="p-6 space-y-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rotationItems.length > 0 ? (
                        groupedRotation.sortedDates.map(date => (
                          <div key={date}>
                            {/* Date Header */}
                            <div className="px-4 py-2 bg-gray-50/80 border-y border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {new Date(date).toLocaleDateString('id-ID', {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                            {/* Items for this date (server sudah urut terbaru dulu) */}
                            {groupedRotation.grouped[date]
                              .map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => handleRotationClick(item)}
                                  className="p-4 flex items-center gap-4 hover:bg-white/50 transition-colors cursor-pointer"
                                >
                                  <div className={`
                                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                                    ${item.type === 'perawatan' ? 'bg-blue-100' : 'bg-garden/10'}
                                  `}>
                                    {item.type === 'perawatan' ? (
                                      <Sparkles className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <RotateCcw className="w-5 h-5 text-garden" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-gray-900 truncate">{item.companyName}</p>
                                      {item.type === 'perawatan' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                          Perawatan
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5" />
                                        {item.type === 'perawatan' ? 'Perawatan Oleh: ' : ''}{item.pic}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Image className="w-3.5 h-3.5" />
                        {item.photo_count || 0} media
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">
                                      {item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'}
                                    </p>
                                    <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Selesai
                                    </p>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <MapPin className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 font-medium">
                            Belum ada rotasi pada rentang tanggal ini
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Pilih rentang tanggal lain
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Muat lebih banyak (server-side pagination) */}
                    {rotationItems.length > 0 && rotationItems.length < rotationTotal && (
                      <div className="p-4 text-center bg-white/50 border-t border-garden/10">
                        <p className="text-xs text-gray-500 mb-2">
                          Menampilkan {rotationItems.length} dari {rotationTotal} rotasi
                        </p>
                        <button
                          onClick={() => fetchRotation(rotationPage + 1, true)}
                          disabled={rotationLoadingMore}
                          className="px-5 py-2 rounded-xl bg-white border border-garden/30 text-garden text-sm font-medium hover:bg-garden/10 transition-colors disabled:opacity-50"
                        >
                          {rotationLoadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                        </button>
                      </div>
                    )}
                  </>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-400">
            © 2026 Mutiari Garden. Report Dokumentasi System. • v{APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
