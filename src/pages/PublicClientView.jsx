import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Eye, 
  Calendar, 
  User, 
  Building2, 
  Image, 
  Video,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  MapPin,
  Phone,
  Package,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  X,
  ArrowLeft,
  Download,
  Search
} from 'lucide-react';
import { validateCompanyShareLink, accessCompanyShareLink } from '../utils/shareLink';
import Skeleton from '../components/Skeleton';
import Lightbox from '../components/Lightbox';
import { getLoadingHistory, getPhotosByHistoryId } from '../utils/supabase';
import { APP_VERSION } from '../utils/version';
import { downloadPhotosAsZip } from '../utils/downloadZip';
import { getMediaTypeFromUrl } from '../utils/media';

const PublicClientView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shareData, setShareData] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const result = await validateCompanyShareLink(token);
      
      if (!result.valid) {
        setError(result.message);
        setIsLoading(false);
        return;
      }

      if (result.requirePassword) {
        setIsPasswordRequired(true);
        setShareData(result.data);
        setIsLoading(false);
        return;
      }

      // No password required, load data
      await loadClientData(result.data);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Terjadi kesalahan saat memvalidasi link');
      setIsLoading(false);
    }
  };

  const loadClientData = async (data) => {
    try {
      setShareData(data);
      
      const companyId = data.companies_reports?.id;
      if (!companyId) {
        setError('Data perusahaan tidak valid');
        setIsLoading(false);
        return;
      }
      
      const historyData = await getLoadingHistory({ companyId });
      setHistory(historyData);
      
      const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      setExpandedMonths({ [currentMonth]: true });
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Gagal memuat data dokumentasi');
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    try {
      setIsLoading(true);
      setError('');

      const result = await accessCompanyShareLink(token, password);
      
      if (!result.success) {
        setError(result.message);
        setIsLoading(false);
        return;
      }

      setIsPasswordRequired(false);
      await loadClientData(result.data);
    } catch (err) {
      console.error('Error accessing with password:', err);
      setError('Terjadi kesalahan');
      setIsLoading(false);
    }
  };

  // Group history by month
  const groupedHistory = useMemo(() => {
    const grouped = {};
    
    history.forEach(item => {
      const monthYear = new Date(item.date).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric'
      });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(item);
    });
    
    // Sort months descending
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(grouped[a][0].date);
      const dateB = new Date(grouped[b][0].date);
      return dateB - dateA;
    });
    
    return { grouped, sortedKeys };
  }, [history]);

  // Filter history by search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      (item.pic || '').toLowerCase().includes(query) ||
      (item.catatan || '').toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  const handleViewDetail = async (item) => {
    try {
      const photos = await getPhotosByHistoryId(item.id);
      setSelectedPhotos(photos.map(p => p.url));
      setSelectedHistory(item);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  };

  const handleDownloadZip = async () => {
    if (isDownloading || selectedPhotos.length === 0) return;
    
    setIsDownloading(true);
    try {
      await downloadPhotosAsZip(
        selectedPhotos,
        shareData?.companies_reports?.name,
        selectedHistory?.date,
        selectedHistory?.pic
      );
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <div className="flex gap-6 pt-4 border-t border-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !shareData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-400">
            Pastikan link yang Anda gunakan benar dan masih aktif.
          </p>
        </div>
      </div>
    );
  }

  // Password required state
  if (isPasswordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Portal Dilindungi Password</h2>
            <p className="text-gray-600 text-sm mt-2">
              Dokumentasi client ini memerlukan password untuk diakses.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Buka Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const company = shareData?.companies_reports;

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Data perusahaan tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img 
                  src={company.logo_url} 
                  alt={company.name}
                  className="h-10 w-10 object-contain rounded-lg"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-garden to-garden-dark flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">{company.name}</h1>
                <p className="text-xs text-gray-500">Portal Dokumentasi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Client Portal
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {/* Company Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="h-24 bg-gradient-to-r from-garden to-garden-dark" />
          <div className="px-6 pb-6">
            <div className="relative -mt-10 mb-4 flex items-end justify-between">
              <div className="w-20 h-20 rounded-2xl bg-white shadow-lg p-1">
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-garden to-garden-dark flex items-center justify-center">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-4">{company.name}</h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <MapPin className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Alamat</p>
                  <p className="text-sm font-medium text-gray-800">{company.address || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <User className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">PIC</p>
                  <p className="text-sm font-medium text-gray-800">{company.pic_name || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <Phone className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Kontak</p>
                  <p className="text-sm font-medium text-gray-800">{company.contact || '-'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-garden/5 border border-garden/10">
                <Package className="w-5 h-5 text-garden flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-garden font-medium mb-0.5">Total Dokumentasi</p>
                  <p className="text-lg font-bold text-gray-900">{history.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jumlah Tanaman */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-garden" />
            Jumlah Tanaman
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.tanaman_meja || 0}</p>
              <p className="text-xs text-gray-500">Meja</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.tanaman_lantai || 0}</p>
              <p className="text-xs text-gray-500">Lantai</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.anggrek_bulan || 0}</p>
              <p className="text-xs text-gray-500">Anggrek Bulan</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.anggrek_dendro || 0}</p>
              <p className="text-xs text-gray-500">Anggrek Dendro</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.planter_box || 0}</p>
              <p className="text-xs text-gray-500">Planter Box</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.vertical_garden || 0}</p>
              <p className="text-xs text-gray-500">Vertical</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.mini_garden || 0}</p>
              <p className="text-xs text-gray-500">Mini Garden</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xl font-bold text-garden">{company.center_piece || 0}</p>
              <p className="text-xs text-gray-500">Center Piece</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari dokumentasi..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white"
          />
        </div>

        {/* Dokumentasi History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-garden" />
            Riwayat Dokumentasi
            <span className="text-sm font-normal text-gray-500">
              ({filteredHistory.length})
            </span>
          </h3>

          {filteredHistory.length > 0 ? (
            <div className="space-y-4">
              {groupedHistory.sortedKeys.map((monthYear) => (
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
                        <p className="text-xs text-gray-500">
                          {groupedHistory.grouped[monthYear].length} aktivitas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {groupedHistory.grouped[monthYear].reduce((acc, item) => acc + (item.photo_count || 0), 0)} media
                      </span>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedMonths[monthYear] ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  
                  {expandedMonths[monthYear] && (
                    <div className="divide-y divide-gray-100">
                      {groupedHistory.grouped[monthYear]
                        .filter(item => filteredHistory.includes(item))
                        .map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => handleViewDetail(item)}
                          className="flex items-center gap-4 p-4 hover:bg-garden/5 transition-all cursor-pointer group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'perawatan' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            {item.type === 'perawatan' ? (
                              <Sparkles className="w-5 h-5 text-blue-600" />
                            ) : (
                              <RotateCcw className="w-5 h-5 text-gray-400" />
                            )}
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
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-garden transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada dokumentasi'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Portal ini dibagikan oleh Mutiari Garden.
            <br />
            Link aktif hingga: {shareData.expires_at
              ? new Date(shareData.expires_at).toLocaleDateString('id-ID')
              : 'Tidak ada batas waktu'}
            <br />
            v{APP_VERSION}
          </p>
        </div>
      </main>

      {/* Detail Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSelectedHistory(null);
              setSelectedPhotos([]);
              setLightboxIndex(null);
            }}
          />
          
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedHistory.type === 'perawatan' ? 'bg-blue-100' : 'bg-garden/10'
                }`}>
                  {selectedHistory.type === 'perawatan' ? (
                    <Sparkles className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Image className="w-5 h-5 text-garden" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {selectedHistory.type === 'perawatan' ? 'Detail Perawatan' : 'Detail Loading'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(selectedHistory.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedHistory(null);
                  setSelectedPhotos([]);
                  setLightboxIndex(null);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-500 mb-0.5">
                    {selectedHistory.type === 'perawatan' ? 'Perawatan Oleh' : 'PIC Loading'}
                  </p>
                  <p className="font-medium text-gray-900">{selectedHistory.pic}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-500 mb-0.5">Jumlah Media</p>
                  <p className="font-medium text-gray-900">{selectedHistory.photo_count || 0} media</p>
                </div>
              </div>

              {/* Catatan */}
              {selectedHistory.catatan && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs font-medium text-amber-700 mb-1">Catatan</p>
                  <p className="text-sm text-gray-700">{selectedHistory.catatan}</p>
                </div>
              )}

              {/* Download */}
              {selectedPhotos.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloading}
                    className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDownloading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan...</>
                    ) : (
                  <><Download className="w-4 h-4" /> Download {selectedPhotos.length} Media (ZIP)</>
                    )}
                  </button>
                </div>
              )}

              {/* Photos */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Media Dokumentasi</h4>
                {selectedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedPhotos.map((photoUrl, index) => {
                      const mediaType = getMediaTypeFromUrl(photoUrl);
                      return (
                        <div
                          key={index}
                          onClick={() => setLightboxIndex(index)}
                          className="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity cursor-pointer relative"
                        >
                          {mediaType === 'video' ? (
                            <>
                              <video src={photoUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
                                  <Video className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img
                              src={photoUrl}
                              alt={`Media ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">Tidak ada media</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && selectedPhotos.length > 0 && (
        <Lightbox
          items={selectedPhotos.map(url => ({ url, mediaType: getMediaTypeFromUrl(url) }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
        />
      )}
    </div>
  );
};

export default PublicClientView;
