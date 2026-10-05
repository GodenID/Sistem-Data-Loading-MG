import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { 
  ArrowLeft, 
  RotateCcw, 
  Search, 
  Calendar, 
  User, 
  Image, 
  Building2,
  Filter,
  X,
  Sparkles,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckSquare,
  Square,
  RefreshCw
} from 'lucide-react';
import LoadingDetailModal from '../components/LoadingDetailModal';
import EditLoadingModal from '../components/EditLoadingModal';
import AppFooter from '../components/AppFooter';
import { getLoadingHistory, getLoadingHistorySummary, getCompanies, deleteLoadingHistory, getPhotosByHistoryId, getTeam } from '../utils/supabase';
import { deleteMultipleFromS3 } from '../utils/s3Config';
import { exportToExcel } from '../utils/exportExcel';

const ITEMS_PER_PAGE = 20;

const AdminHistory = () => {
  const navigate = useNavigate();
  const [loadingHistory, setLoadingHistory] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, loading: 0, perawatan: 0, media: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCrew, setSelectedCrew] = useState('all');
  const [teamList, setTeamList] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLoading, setSelectedLoading] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingLoading, setEditingLoading] = useState(null);
  
  // Sorting states
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Multi-select states
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  // Debounce input pencarian agar tidak query tiap ketikan (400ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Bangun filter server dari state UI.
  // company/type/date dikirim ke Supabase; search teks = nama perusahaan ATAU pic.
  const buildServerFilters = () => {
    const f = {
      sortBy: sortField === 'company' ? 'date' : sortField,
      sortDir: sortDirection,
    };
    if (selectedCompany !== 'all') f.companyId = parseInt(selectedCompany);
    if (selectedCrew !== 'all') f.crewUserId = parseInt(selectedCrew);
    if (selectedType !== 'all') f.type = selectedType;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    if (searchQuery) {
      if (selectedCompany === 'all') {
        const q = searchQuery.toLowerCase();
        const matched = companies
          .filter(c => (c.name || '').toLowerCase().includes(q))
          .map(c => c.id);
        if (matched.length > 0) f.companyIds = matched;
      }
      f.picSearch = searchQuery;
    }
    return f;
  };

  // Fetch halaman aktif dari server (bukan full-table)
  const fetchPage = async (page = currentPage) => {
    try {
      setIsLoading(true);
      const filters = buildServerFilters();
      const { data, count } = await getLoadingHistory(filters, { page, limit: ITEMS_PER_PAGE });
      let items = data || [];
      // Sort nama perusahaan hanya bisa di memori (kolom join) — per halaman
      if (sortField === 'company') {
        items = [...items].sort((a, b) =>
          sortDirection === 'asc'
            ? (a.companyName || '').localeCompare(b.companyName || '')
            : (b.companyName || '').localeCompare(a.companyName || '')
        );
      }
      setLoadingHistory(items);
      setTotalCount(count ?? 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Ringkasan filter aktif via count ringan (tanpa fetch full-table)
  const fetchSummary = async () => {
    try {
      const filters = buildServerFilters();
      delete filters.sortBy;
      delete filters.sortDir;
      const s = await getLoadingHistorySummary(filters);
      setSummary(s);
    } catch (error) {
      console.warn('Gagal memuat ringkasan:', error?.message);
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchPage(currentPage), fetchSummary()]);
  };

  const fetchCompaniesOnce = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
    try {
      setTeamList(await getTeam());
    } catch (error) {
      console.warn('Error fetching team:', error?.message);
    }
  };

  // Auto-refresh: Refresh data when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchPage();
      fetchSummary();
    };

    window.addEventListener('focus', handleFocus);

    // Also refresh every 2 minutes
    const interval = setInterval(() => {
      fetchPage();
      fetchSummary();
    }, 120000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, selectedCompany, selectedType, dateFrom, dateTo, sortField, sortDirection, companies]);

  useEffect(() => {
    fetchCompaniesOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ulang saat filter/sort/page berubah (server-side)
  useEffect(() => {
    fetchPage();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, selectedCompany, selectedType, dateFrom, dateTo, sortField, sortDirection, companies]);

  // Data halaman aktif sudah difilter + disort oleh server.
  // Alias ini dipertahankan agar sisa render tidak perlu diubah.
  const paginatedHistory = loadingHistory;

  // Pagination server: total dari count Supabase + nomor halaman ringkas
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  }, [currentPage, totalPages]);
  const pageRangeStart = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageRangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set()); // Clear selection on filter change
  }, [searchQuery, selectedCompany, selectedType, selectedCrew, dateFrom, dateTo]);

  // Ringkasan dari query count ringan (bukan dari full-table)
  const totalPhotos = summary.media;
  const totalLoading = summary.loading;
  const totalPerawatan = summary.perawatan;

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedCompany('all');
    setSelectedType('all');
    setSelectedCrew('all');
    setDateFrom('');
    setDateTo('');
    setSelectedItems(new Set());
  };

  const hasActiveFilters = searchQuery || selectedCompany !== 'all' || selectedType !== 'all' || selectedCrew !== 'all' || dateFrom || dateTo;

  // Handle Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle Select Item
  const toggleSelectItem = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // Handle Select All on Page
  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedHistory.map(item => item.id);
    const allSelected = pageIds.every(id => selectedItems.has(id));
    
    const newSelected = new Set(selectedItems);
    if (allSelected) {
      // Deselect all on page
      pageIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on page
      pageIds.forEach(id => newSelected.add(id));
    }
    setSelectedItems(newSelected);
  };

  // Hapus foto di S3 dulu, baru record DB (foto ikut terhapus via CASCADE).
  // Gagal hapus S3 tidak menggagalkan hapus DB — hanya dilaporkan.
  const deleteHistoryWithMedia = async (id) => {
    let s3deleted = 0;
    let s3failed = 0;
    try {
      const photos = await getPhotosByHistoryId(id);
      const urls = (photos || []).map(p => p.url).filter(Boolean);
      if (urls.length > 0) {
        const res = await deleteMultipleFromS3(urls);
        s3deleted = res.deleted;
        s3failed = res.failed;
      }
    } catch (e) {
      console.warn(`Gagal ambil/hapus foto S3 untuk history ${id}:`, e?.message);
    }
    await deleteLoadingHistory(id);
    return { s3deleted, s3failed };
  };

  // Handle Multi Delete
  const handleMultiDelete = async () => {
    try {
      setIsDeleting(true);

      const idsToDelete = Array.from(selectedItems);
      let ok = 0;
      let s3failedTotal = 0;
      const failedIds = [];
      for (const id of idsToDelete) {
        try {
          const r = await deleteHistoryWithMedia(id);
          s3failedTotal += r.s3failed;
          ok += 1;
        } catch (e) {
          console.error(`Gagal hapus history ${id}:`, e);
          failedIds.push(id);
        }
      }

      // Refresh data
      await fetchData();
      setSelectedItems(new Set());
      setShowMultiDeleteConfirm(false);

      if (failedIds.length === 0) {
        toast.success(
          `Berhasil hapus ${ok} data beserta fotonya.` +
          (s3failedTotal > 0 ? ` (${s3failedTotal} file S3 gagal dihapus, DB tetap bersih)` : '')
        );
      } else {
        toast.error(`Berhasil hapus ${ok} data, gagal ${failedIds.length}. Coba lagi untuk sisanya.`);
      }

    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Gagal menghapus: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Single Delete
  const handleDelete = async (item) => {
    try {
      setIsDeleting(true);

      const r = await deleteHistoryWithMedia(item.id);

      // Kalau halaman jadi kosong (item terakhir di page), mundur 1 halaman
      if (paginatedHistory.length <= 1 && currentPage > 1) {
        setCurrentPage(p => p - 1);
      } else {
        await fetchData();
      }
      setShowDeleteConfirm(null);
      toast.success(
        'Data beserta fotonya berhasil dihapus.' +
        (r.s3failed > 0 ? ` (${r.s3failed} file S3 gagal dihapus, DB tetap bersih)` : '')
      );

    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Gagal menghapus: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Edit Success
  const handleEditSuccess = () => {
    fetchData();
    setEditingLoading(null);
  };

  // Handle Export Excel — export SELURUH hasil filter (semua halaman),
  // bukan cuma halaman aktif. Kolom Sales + sheet Rekap per Sales ikut.
  const handleExport = async () => {
    if (summary.total === 0) {
      setExportStatus({
        type: 'error',
        message: 'Tidak ada data untuk diexport'
      });
      return;
    }

    setIsExporting(true);
    setExportStatus({ type: 'loading', message: 'Mengambil seluruh data filter...' });

    try {
      const filters = buildServerFilters();
      delete filters.sortBy;
      delete filters.sortDir;
      const allData = await getLoadingHistory(filters);
      setExportStatus({ type: 'loading', message: `Menyusun ${allData.length} baris Excel...` });
      const result = await exportToExcel(allData, 'report-mutiari-garden', companies);
      setExportStatus({
        type: 'success',
        message: `Berhasil export ${result.count} data ke ${result.filename}`
      });

      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus({
        type: 'error',
        message: error.message || 'Gagal export data'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">History Dokumentasi</h1>
              <p className="text-xs text-gray-500">{totalCount} data ditemukan</p>
            </div>
            <button
              onClick={() => fetchData()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
              title="Refresh Data"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium text-sm transition-colors shrink-0 ${
                showFilters || hasActiveFilters
                  ? 'bg-garden text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {hasActiveFilters && (
                <span className="ml-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">!</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="grid md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Cari</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Cari perusahaan atau PIC..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10"
                  />
                </div>
              </div>

              {/* Company Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Perusahaan</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white"
                >
                  <option value="all">Semua Perusahaan</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jenis</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white"
                >
                  <option value="all">Semua Jenis</option>
                  <option value="loading">Loading</option>
                  <option value="perawatan">Perawatan</option>
                </select>
              </div>

              {/* Tim Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tim</label>
                <select
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white"
                >
                  <option value="all">Semua Tim</option>
                  {teamList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.username}</option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rentang Tanggal</label>
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
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
              >
                <X className="w-4 h-4" />
                <span>Hapus Filter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary & Export */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <span className="text-sm text-gray-500">Total: </span>
              <span className="font-semibold text-gray-900">{summary.total}</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <span className="text-sm text-gray-500">Loading: </span>
              <span className="font-semibold text-garden">{totalLoading}</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <span className="text-sm text-gray-500">Perawatan: </span>
              <span className="font-semibold text-blue-600">{totalPerawatan}</span>
            </div>
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
                    <span className="text-sm text-gray-500">Total Media: </span>
              <span className="font-semibold text-gray-900">{totalPhotos}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Multi-delete button */}
            {selectedItems.size > 0 && (
              <button
                onClick={() => setShowMultiDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus ({selectedItems.size})</span>
              </button>
            )}
            
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting || summary.total === 0}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                transition-all duration-200
                ${isExporting || summary.total === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20'
                }
              `}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export Excel</span>
            </button>
          </div>
        </div>
        
        {/* Export Status */}
        {exportStatus && (
          <div className={`
            mt-3 p-3 rounded-xl flex items-center gap-2 text-sm
            ${exportStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : ''}
            ${exportStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : ''}
            ${exportStatus.type === 'loading' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
          `}>
            {exportStatus.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {exportStatus.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {exportStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
            <span>{exportStatus.message}</span>
          </div>
        )}
      </div>

      {/* History List */}
      <main className="max-w-6xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Memuat data history...</p>
          </div>
        ) : paginatedHistory.length > 0 ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">
                        <button
                          onClick={toggleSelectAllOnPage}
                          className="p-1 rounded hover:bg-gray-200"
                        >
                          {paginatedHistory.every(item => selectedItems.has(item.id)) ? (
                            <CheckSquare className="w-5 h-5 text-garden" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center gap-1">
                          Tanggal
                          <ArrowUpDown className={`w-3 h-3 ${sortField === 'date' ? 'text-garden' : ''}`} />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Jenis</th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('company')}
                      >
                        <div className="flex items-center gap-1">
                          Perusahaan
                          <ArrowUpDown className={`w-3 h-3 ${sortField === 'company' ? 'text-garden' : ''}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('pic')}
                      >
                        <div className="flex items-center gap-1">
                          {selectedType === 'perawatan' ? 'Perawatan Oleh' : 'PIC'}
                          <ArrowUpDown className={`w-3 h-3 ${sortField === 'pic' ? 'text-garden' : ''}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('photos')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Media
                          <ArrowUpDown className={`w-3 h-3 ${sortField === 'photos' ? 'text-garden' : ''}`} />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('created')}
                      >
                        <div className="flex items-center gap-1">
                          Waktu Input
                          <ArrowUpDown className={`w-3 h-3 ${sortField === 'created' ? 'text-garden' : ''}`} />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedHistory.map((item) => {
                      const isPerawatan = item.type === 'perawatan';
                      const isSelected = selectedItems.has(item.id);
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-garden/5 transition-all border-l-4 ${isSelected ? 'border-garden bg-garden/5' : 'border-transparent'}`}
                        >
                          <td className="px-3 py-4 text-center">
                            <button
                              onClick={() => toggleSelectItem(item.id)}
                              className="p-1 rounded hover:bg-gray-200"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-garden" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-4 cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(item.date).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            {isPerawatan ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium">
                                <Sparkles className="w-3 h-3" />
                                Perawatan
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-garden/10 text-garden text-xs font-medium">
                                <RotateCcw className="w-3 h-3" />
                                Loading
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-garden flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900 line-clamp-1">{item.companyName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {isPerawatan && <span className="text-gray-400">Perawatan Oleh: </span>}
                                {item.pic || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-600">
                              <Image className="w-3 h-3" />
                              <span className="text-xs font-medium">{item.photo_count || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 cursor-pointer" onClick={() => setSelectedLoading(item)}>
                            <span className="text-xs text-gray-500">
                              {item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLoading(item);
                                }}
                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteConfirm(item);
                                }}
                                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination (server-side, nomor ringkas max 5) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Halaman {currentPage} dari {totalPages}
                  <span className="ml-2">({pageRangeStart}-{pageRangeEnd} dari {totalCount})</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {pageNumbers.map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl font-medium text-sm transition-colors ${
                        currentPage === page
                          ? 'bg-garden text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Tidak ada data history</p>
            <p className="text-sm text-gray-400 mt-1">Coba ubah filter pencarian</p>
          </div>
        )}
      </main>
      <AppFooter />

      {/* Detail Modal */}
      <LoadingDetailModal
        isOpen={!!selectedLoading}
        onClose={() => setSelectedLoading(null)}
        loadingData={selectedLoading}
        onSuccess={fetchData}
      />

      {/* Edit Modal */}
      <EditLoadingModal
        isOpen={!!editingLoading}
        onClose={() => setEditingLoading(null)}
        loadingData={editingLoading}
        onSuccess={handleEditSuccess}
      />

      {/* Single Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Riwayat?</h3>
              <p className="text-gray-500">
                Apakah Anda yakin ingin menghapus data {showDeleteConfirm.type === 'perawatan' ? 'perawatan' : 'loading'} dari{' '}
                <strong>{showDeleteConfirm.companyName}</strong>?
                <br />
                <span className="text-sm text-gray-500">Foto/video di storage ikut dihapus.</span>
                <br />
                <span className="text-red-500 text-sm">Tindakan ini tidak dapat dibatalkan.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Menghapus...</span></>
                ) : (
                  <><Trash2 className="w-4 h-4" /><span>Hapus</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi Delete Confirmation Modal */}
      {showMultiDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus {selectedItems.size} Data?</h3>
              <p className="text-gray-500">
                Apakah Anda yakin ingin menghapus <strong>{selectedItems.size}</strong> data yang dipilih?
                <br />
                <span className="text-sm text-gray-500">Foto/video di storage ikut dihapus.</span>
                <br />
                <span className="text-red-500 text-sm">Tindakan ini tidak dapat dibatalkan.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMultiDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleMultiDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Menghapus...</span></>
                ) : (
                  <><Trash2 className="w-4 h-4" /><span>Hapus Semua</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHistory;
