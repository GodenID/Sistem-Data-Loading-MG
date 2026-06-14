import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  ArrowLeft,
  Download,
  X
} from 'lucide-react';
import { validateShareLink, accessShareLink } from '../utils/shareLink';
import Skeleton from '../components/Skeleton';
import { getPhotosByHistoryId } from '../utils/supabase';
import { downloadPhotosAsZip } from '../utils/downloadZip';
import { getMediaTypeFromUrl } from '../utils/media';

const PublicShareView = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shareData, setShareData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { setSelectedPhoto(null); return; }
      if (e.key === 'ArrowLeft') {
        const newIndex = selectedPhoto.index > 0 ? selectedPhoto.index - 1 : photos.length - 1;
        setSelectedPhoto({ url: photos[newIndex], index: newIndex, mediaType: getMediaTypeFromUrl(photos[newIndex]) });
      }
      if (e.key === 'ArrowRight') {
        const newIndex = selectedPhoto.index < photos.length - 1 ? selectedPhoto.index + 1 : 0;
        setSelectedPhoto({ url: photos[newIndex], index: newIndex, mediaType: getMediaTypeFromUrl(photos[newIndex]) });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPhoto, photos]);

  const validateToken = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const result = await validateShareLink(token);
      
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
      await loadShareData(result.data);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Terjadi kesalahan saat memvalidasi link');
      setIsLoading(false);
    }
  };

  const loadShareData = async (data) => {
    try {
      setShareData(data);
      
      // Load photos
      const photosData = await getPhotosByHistoryId(data.history_id);
      setPhotos(photosData.map(p => p.url));
      
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

      const result = await accessShareLink(token, password);
      
      if (!result.success) {
        setError(result.message);
        setIsLoading(false);
        return;
      }

      setIsPasswordRequired(false);
      await loadShareData(result.data);
    } catch (err) {
      console.error('Error accessing with password:', err);
      setError('Terjadi kesalahan');
      setIsLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (isDownloading || photos.length === 0) return;
    
    setIsDownloading(true);
    try {
      await downloadPhotosAsZip(
        photos,
        shareData.loading_history_reports.companies_reports.name,
        shareData.loading_history_reports.date,
        shareData.loading_history_reports.pic
      );
    } catch (err) {
      console.error('Download error:', err);
      setError('Gagal mengunduh foto');
    } finally {
      setIsDownloading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 rounded-2xl" />
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
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
            <h2 className="text-xl font-bold text-gray-900">Link Dilindungi Password</h2>
            <p className="text-gray-600 text-sm mt-2">
              Dokumentasi ini memerlukan password untuk diakses.
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
              Buka Dokumentasi
            </button>
          </form>
        </div>
      </div>
    );
  }

  const history = shareData?.loading_history_reports;
  const company = history?.companies_reports;
  const isPerawatan = history?.type === 'perawatan';

  if (!history || !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Data tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-10 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Mutiari Garden</h1>
                <p className="text-xs text-gray-500">Dokumentasi Shared</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Public View
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className={`h-2 ${isPerawatan ? 'bg-blue-500' : 'bg-green-500'}`} />
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
                  {isPerawatan && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      Perawatan
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{company.address}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isPerawatan ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {isPerawatan ? (
                  <Sparkles className="w-6 h-6 text-blue-600" />
                ) : (
                  <RotateCcw className="w-6 h-6 text-green-600" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Tanggal</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(history.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">
                    {isPerawatan ? 'Perawatan Oleh' : 'PIC Loading'}
                  </p>
                  <p className="text-sm font-medium text-gray-900">{history.pic}</p>
                </div>
              </div>
            </div>

            {/* Catatan */}
            {history.catatan && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">Catatan</p>
                    <p className="text-sm text-gray-700">{history.catatan}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Download Section */}
        {photos.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Image className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{photos.length} Media Dokumentasi</p>
                  <p className="text-xs text-gray-500">Klik media untuk melihat detail</p>
                </div>
              </div>
              <button
                onClick={handleDownloadZip}
                disabled={isDownloading}
                className="px-4 py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isDownloading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan...</>
                ) : (
                  <><Download className="w-4 h-4" /> Download ZIP</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Photos Grid */}
        <div>
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Image className={`w-5 h-5 ${isPerawatan ? 'text-blue-500' : 'text-green-500'}`} />
            Media Dokumentasi
          </h3>

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photoUrl, index) => {
                const mediaType = getMediaTypeFromUrl(photoUrl);
                return (
                  <div 
                    key={index}
                    onClick={() => setSelectedPhoto({ url: photoUrl, index, mediaType })}
                    className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-400 transition-all duration-200 group relative bg-gray-100`}
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-xs font-medium">
                      {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Tidak ada media</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Dokumentasi ini dibagikan melalui Mutiari Garden Report System.
            <br />
            Link aktif hingga: {shareData.expires_at 
              ? new Date(shareData.expires_at).toLocaleDateString('id-ID') 
              : 'Tidak ada batas waktu'}
          </p>
        </div>
      </main>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Navigation */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = selectedPhoto.index > 0 ? selectedPhoto.index - 1 : photos.length - 1;
                  setSelectedPhoto({ url: photos[newIndex], index: newIndex, mediaType: getMediaTypeFromUrl(photos[newIndex]) });
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = selectedPhoto.index < photos.length - 1 ? selectedPhoto.index + 1 : 0;
                  setSelectedPhoto({ url: photos[newIndex], index: newIndex, mediaType: getMediaTypeFromUrl(photos[newIndex]) });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-6 h-6 rotate-180" />
              </button>
            </>
          )}
          
          {selectedPhoto.mediaType === 'video' ? (
            <video
              src={selectedPhoto.url}
              className="max-w-full max-h-[85vh] rounded-lg"
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={selectedPhoto.url}
              alt={`Media ${selectedPhoto.index + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-sm">
            Media {selectedPhoto.index + 1} dari {photos.length}
          </p>
        </div>
      )}
    </div>
  );
};

export default PublicShareView;
