import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Phone, 
  User,
  Package,
  Plus,
  Calendar,
  Image,
  Clock,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Sparkles,
  RotateCcw,
  Loader2,
  Search,
  Pencil,
  ChevronLeft,
  Filter,
  X,
  Link2
} from 'lucide-react';
import DocumentationModal from '../components/DocumentationModal';
import Skeleton from '../components/Skeleton';
import LoadingDetailModal from '../components/LoadingDetailModal';
import EditLoadingModal from '../components/EditLoadingModal';
import ShareLinkModal from '../components/ShareLinkModal';
import AppFooter from '../components/AppFooter';
import PullIndicator from '../components/PullIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getCompanyBySlug, getLoadingHistory, checkLoadingDuplicate } from '../utils/supabase';

const ITEMS_PER_PAGE = 10;

// Helper untuk format nama bulan
const formatMonthYear = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });
};

// Helper untuk grouping data per bulan
const groupByMonth = (data) => {
  const grouped = {};
  
  data.forEach(item => {
    const monthYear = formatMonthYear(item.date);
    if (!grouped[monthYear]) {
      grouped[monthYear] = [];
    }
    grouped[monthYear].push(item);
  });
  
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const dateA = new Date(grouped[a][0].date);
    const dateB = new Date(grouped[b][0].date);
    return dateB - dateA;
  });
  
  sortedKeys.forEach(key => {
    grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
  });
  
  return { grouped, sortedKeys };
};

// Icon berdasarkan type
const TypeIcon = ({ type, className }) => {
  if (type === 'perawatan') {
    return <Sparkles className={className} />;
  }
  return <RotateCcw className={className} />;
};

const ClientDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  // Riwayat: hanya halaman aktif yang dimuat (server-side, bukan full-table)
  const [historyItems, setHistoryItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [isPerawatanModalOpen, setIsPerawatanModalOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [selectedLoading, setSelectedLoading] = useState(null);
  const [editingLoading, setEditingLoading] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Search, Filter and Pagination states
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-refresh: Refresh halaman aktif saat window regain focus
  // (tetap di halaman, tidak loncat ke halaman 1)
  useEffect(() => {
    const handleFocus = () => {
      if (company) {
        fetchHistoryPage();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Also refresh every 2 minutes
    const interval = setInterval(() => {
      if (company) {
        fetchHistoryPage();
      }
    }, 120000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, currentPage, searchQuery, filterType, dateFrom, dateTo]);

  // Fetch company data from Supabase (satu baris saja)
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setIsLoading(true);
        const companyData = await getCompanyBySlug(slug);

        if (companyData) {
          setCompany(companyData);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [slug]);

  // Bangun filter server dari state UI
  const buildServerFilters = () => {
    const f = {
      companyId: company?.id,
      sortBy: 'date',
      sortDir: 'desc',
    };
    if (filterType !== 'all') f.type = filterType;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    if (searchQuery.trim()) f.picSearch = searchQuery.trim();
    return f;
  };

  // Fetch halaman aktif dari server
  const fetchHistoryPage = async (page = currentPage) => {
    if (!company?.id) return;
    try {
      setListLoading(true);
      const { data, count } = await getLoadingHistory(buildServerFilters(), { page, limit: ITEMS_PER_PAGE });
      setHistoryItems(data || []);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setListLoading(false);
    }
  };

  // Debounce ketikan pencarian PIC 400ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch ulang saat halaman/filter berubah (server-side)
  useEffect(() => {
    fetchHistoryPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, currentPage, searchQuery, filterType, dateFrom, dateTo]);
  
  // Refresh data when window regains focus (user returns from admin)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && company?.id) {
        getCompanyBySlug(slug).then(companyData => {
          if (companyData) {
            setCompany(companyData);
          }
        }).catch(() => {});
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [company?.id, slug]);

  // Data halaman aktif sudah difilter server (company/type/date/pic).
  // Alias dipertahankan agar render tidak perlu diubah.
  const paginatedHistory = historyItems;

  // Pagination server: total dari count Supabase
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, dateFrom, dateTo]);

  // Group data per bulan
  const { grouped: groupedHistory, sortedKeys: monthKeys } = useMemo(() => {
    return groupByMonth(paginatedHistory);
  }, [paginatedHistory]);

  // Toggle expand/collapse bulan
  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // Expand semua bulan by default
  useEffect(() => {
    const defaultExpanded = {};
    monthKeys.forEach(key => {
      defaultExpanded[key] = true;
    });
    setExpandedMonths(defaultExpanded);
  }, [monthKeys.join(',')]);

  // Refresh data: data baru selalu di halaman 1 (urutan terbaru dulu).
  // Kalau sedang di halaman 1, fetch langsung; kalau tidak, pindah ke halaman 1
  // dan biarkan effect yang fetch.
  const refreshData = async () => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      await fetchHistoryPage(1);
    }
  };

  // Refresh halaman aktif (dipakai setelah edit: posisi halaman dipertahankan).
  // Kalau halaman jadi kosong, mundur satu halaman.
  const refreshCurrentPage = async () => {
    await fetchHistoryPage(currentPage);
  };

  // Tarik ke bawah (HP) untuk refresh + auto-refresh saat upload background selesai
  const { pull, refreshing } = usePullToRefresh(() => fetchHistoryPage(), !!company);

  useEffect(() => {
    const handleUploadDone = (e) => {
      if (e?.detail?.companyId === company?.id) {
        refreshData();
      }
    };
    window.addEventListener('mg-upload-done', handleUploadDone);
    return () => window.removeEventListener('mg-upload-done', handleUploadDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, currentPage]);

  // Check duplikat langsung ke DB (memori hanya berisi 1 halaman, tak lengkap)
  const checkDuplicate = async (date, type) => {
    if (!company?.id) return false;
    try {
      return await checkLoadingDuplicate(company.id, date, type);
    } catch (e) {
      console.warn('Gagal cek duplikat:', e?.message);
      return false;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setFilterType('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchInput || searchQuery || filterType !== 'all' || dateFrom || dateTo;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-5 w-24" />
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton.Avatar className="w-16 h-16" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-12" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-12" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Company not found
  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Perusahaan Tidak Ditemukan</h2>
          <p className="text-gray-500 mb-6">Data perusahaan yang Anda cari tidak tersedia</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-garden text-white rounded-xl font-medium hover:bg-garden-dark transition-colors"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PullIndicator pull={pull} refreshing={refreshing} />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">Detail Perusahaan</h1>
              <p className="text-xs text-gray-500">{company.name}</p>
            </div>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
              title="Share Portal Client"
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-40">
        {/* Company Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="h-24 bg-gradient-to-r from-garden to-garden-dark" />
          <div className="px-5 pb-5">
            <div className="relative -mt-12 mb-4">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-lg p-1">
                <div className="w-full h-full rounded-xl flex items-center justify-center overflow-hidden bg-white border border-gray-200">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="w-full h-full object-contain p-2"
                      onError={(e) => {
                        console.error('Logo failed to load:', company.logo_url);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-garden to-garden-dark ${company.logo_url ? 'hidden' : ''}`}>
                    <Building2 className="w-12 h-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{company.name}</h2>
            <div className="space-y-3">
              {/* Alamat */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <MapPin className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Alamat</p>
                  <p className="text-sm font-medium text-gray-800">{company.address || '-'}</p>
                </div>
              </div>

              {/* PIC & Kontak */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <User className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">PIC</p>
                    <p className="text-sm font-medium text-gray-800 truncate">{company.pic_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                  <Phone className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Kontak</p>
                    <p className="text-sm font-medium text-gray-800 truncate">{company.contact || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Sales */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <User className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">Nama Sales</p>
                  <p className="text-sm font-medium text-gray-800">{company.sales_name || '-'}</p>
                </div>
              </div>

              {/* PIC Loading */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <User className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">PIC Loading</p>
                  <p className="text-sm font-medium text-gray-800">{company.pic_loading || '-'}</p>
                </div>
              </div>

              {/* Jumlah Tanaman */}
              <div className="p-3 rounded-xl bg-garden/5 border border-garden/10">
                <p className="text-xs text-garden font-medium mb-2">Jumlah Tanaman</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.tanaman_meja || 0}</p>
                    <p className="text-[10px] text-gray-500">Meja</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.tanaman_lantai || 0}</p>
                    <p className="text-[10px] text-gray-500">Lantai</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.anggrek_bulan || 0}</p>
                    <p className="text-[10px] text-gray-500">Anggrek Bulan</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.anggrek_dendro || 0}</p>
                    <p className="text-[10px] text-gray-500">Anggrek Dendro</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.planter_box || 0}</p>
                    <p className="text-[10px] text-gray-500">Planter Box</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.vertical_garden || 0}</p>
                    <p className="text-[10px] text-gray-500">Vertical</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.mini_garden || 0}</p>
                    <p className="text-[10px] text-gray-500">Mini Garden</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="text-lg font-bold text-garden">{company.center_piece || 0}</p>
                    <p className="text-[10px] text-gray-500">Center Piece</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari berdasarkan PIC..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <span className="text-gray-500 text-xs">×</span>
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors w-full justify-center ${
              showFilters || hasActiveFilters
                ? 'bg-garden text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter Lanjutan</span>
            {hasActiveFilters && (
              <span className="ml-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">!</span>
            )}
          </button>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Rentang Tanggal</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden text-sm"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden text-sm"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Jenis Dokumentasi</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden bg-white"
                >
                  <option value="all">Semua Jenis</option>
                  <option value="loading">Loading</option>
                  <option value="perawatan">Perawatan</option>
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 w-full justify-center py-2"
                >
                  <X className="w-4 h-4" />
                  <span>Hapus Semua Filter</span>
                </button>
              )}
            </div>
          )}

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchInput && (
                <span className="text-xs px-2 py-1 rounded-lg bg-garden/10 text-garden">
                  PIC: {searchInput}
                </span>
              )}
              {filterType !== 'all' && (
                <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-600">
                  Jenis: {filterType === 'loading' ? 'Loading' : 'Perawatan'}
                </span>
              )}
              {dateFrom && (
                <span className="text-xs px-2 py-1 rounded-lg bg-orange-100 text-orange-600">
                  Dari: {new Date(dateFrom).toLocaleDateString('id-ID')}
                </span>
              )}
              {dateTo && (
                <span className="text-xs px-2 py-1 rounded-lg bg-orange-100 text-orange-600">
                  Sampai: {new Date(dateTo).toLocaleDateString('id-ID')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Loading History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-garden" />
              <h3 className="font-bold text-gray-900">Riwayat Dokumentasi</h3>
              {listLoading && <Loader2 className="w-4 h-4 text-garden animate-spin" />}
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {totalCount} data
            </span>
          </div>

          {listLoading && historyItems.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : historyItems.length > 0 ? (
            <>
              <div className="space-y-4">
                {monthKeys.map((monthYear) => (
                  <div key={monthYear} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleMonth(monthYear)}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-garden/5 to-transparent hover:bg-garden/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-garden" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-gray-900">{monthYear}</h4>
                          <p className="text-xs text-gray-500">{groupedHistory[monthYear].length} aktivitas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {groupedHistory[monthYear].reduce((acc, item) => acc + (item.photo_count || 0), 0)} media
                        </span>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedMonths[monthYear] ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    
                    {expandedMonths[monthYear] && (
                      <div className="divide-y divide-gray-100">
                        {groupedHistory[monthYear].map((item) => (
                          <div 
                            key={item.id}
                            className="flex items-center gap-4 p-4 hover:bg-garden/5 transition-all group"
                          >
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => setSelectedLoading(item)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'perawatan' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                  <TypeIcon type={item.type} className={`w-5 h-5 ${item.type === 'perawatan' ? 'text-blue-600' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-gray-900">
                                      {new Date(item.date).toLocaleDateString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </span>
                                    {item.type === 'perawatan' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Perawatan</span>
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
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLoading(item);
                              }}
                              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Halaman {currentPage} dari {totalPages}
                    <span className="ml-2">
                      ({totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} dari {totalCount})
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-garden text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {hasActiveFilters ? 'Tidak ada hasil pencarian' : 'Belum ada data'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-garden hover:text-garden-dark"
                >
                  Hapus filter
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <AppFooter />

      {/* Floating Action Buttons: speed-dial */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
        {/* Backdrop */}
        {isFabOpen && (
          <div
            className="fixed inset-0 -z-10 bg-black/30 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setIsFabOpen(false)}
          />
        )}
        {/* Opsi Perawatan */}
        <div
          className={`flex items-center gap-3 transition-all duration-200 ${
            isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <span className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg">
            Input Perawatan
          </span>
          <button
            onClick={() => { setIsFabOpen(false); setIsPerawatanModalOpen(true); }}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            title="Input Perawatan"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
        {/* Opsi Loading */}
        <div
          className={`flex items-center gap-3 transition-all duration-200 delay-75 ${
            isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <span className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium shadow-lg">
            Input Loading
          </span>
          <button
            onClick={() => { setIsFabOpen(false); setIsLoadingModalOpen(true); }}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-garden to-garden-dark text-white shadow-lg shadow-garden/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            title="Input Loading"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
        {/* Tombol utama */}
        <button
          onClick={() => setIsFabOpen(v => !v)}
          className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
            isFabOpen
              ? 'bg-gray-800 shadow-gray-800/30 rotate-45'
              : 'bg-gradient-to-r from-garden to-garden-dark shadow-garden/40'
          }`}
          title={isFabOpen ? 'Tutup' : 'Tambah dokumentasi'}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Input Modal */}
      <DocumentationModal
        isOpen={isLoadingModalOpen}
        onClose={() => setIsLoadingModalOpen(false)}
        companyName={company.name}
        companyId={company.id}
        checkDuplicate={checkDuplicate}
        onSuccess={refreshData}
        type="loading"
      />

      <DocumentationModal
        isOpen={isPerawatanModalOpen}
        onClose={() => setIsPerawatanModalOpen(false)}
        companyName={company.name}
        companyId={company.id}
        checkDuplicate={checkDuplicate}
        onSuccess={refreshData}
        type="perawatan"
      />

      {/* Detail Modal */}
      <LoadingDetailModal
        isOpen={!!selectedLoading}
        onClose={() => setSelectedLoading(null)}
        loadingData={selectedLoading}
      />

      {/* Edit Modal */}
      <EditLoadingModal
        isOpen={!!editingLoading}
        onClose={() => setEditingLoading(null)}
        loadingData={editingLoading}
        onSuccess={refreshCurrentPage}
      />

      {/* Share Portal Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        companyId={company?.id}
        companyName={company?.name}
        companyData={company}
      />
    </div>
  );
};

export default ClientDetail;
