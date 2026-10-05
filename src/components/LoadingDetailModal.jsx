import React, { useEffect, useState, useCallback } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Building2, 
  Image, 
  Video,
  Clock, 
  Download, 
  Archive,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  FileText,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { downloadPhotosAsZip } from '../utils/downloadZip';
import { getPhotosByHistoryId, deletePhotoRecord, updateLoadingHistory } from '../utils/supabase';
import { deleteFromS3 } from '../utils/s3Config';
import { getMediaTypeFromUrl } from '../utils/media';
import Lightbox from './Lightbox';

const LoadingDetailModal = ({ isOpen, onClose, loadingData, onSuccess }) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);

  useEffect(() => {
    if (isOpen && loadingData?.id) {
      fetchPhotos();
    }
  }, [isOpen, loadingData?.id]);

  const fetchPhotos = async () => {
    try {
      setIsLoadingPhotos(true);
      const photosData = await getPhotosByHistoryId(loadingData.id);
      const mediaItems = photosData.map(p => ({
        id: p.id,
        url: p.url,
        filename: p.filename,
        mediaType: getMediaTypeFromUrl(p.url, p.filename)
      }));
      setPhotos(mediaItems);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setLightboxIndex(null);
      setDownloadStatus(null);
      setPhotos([]);
      setSelectedIds(new Set());
      setShowDeleteConfirm(null);
      setDeleteStatus(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSingle = async (photo) => {
    setShowDeleteConfirm({ type: 'single', photo });
  };

  const handleDeleteSelected = () => {
    setShowDeleteConfirm({ type: 'multi', ids: selectedIds });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      let idsToDelete;
      if (showDeleteConfirm.type === 'single') {
        idsToDelete = [showDeleteConfirm.photo.id];
        await deleteFromS3(showDeleteConfirm.photo.url);
        await deletePhotoRecord(showDeleteConfirm.photo.id);
      } else {
        idsToDelete = Array.from(showDeleteConfirm.ids);
        const photosToDelete = photos.filter(p => idsToDelete.includes(p.id));
        for (const photo of photosToDelete) {
          try {
            await deleteFromS3(photo.url);
          } catch (e) {
            console.warn('Failed to delete from S3:', e);
          }
        }
        for (const id of idsToDelete) {
          await deletePhotoRecord(id);
        }
      }

      const remainingCount = photos.length - idsToDelete.length;
      await updateLoadingHistory(loadingData.id, {
        photo_count: remainingCount
      });

      setDeleteStatus({
        type: 'success',
        message: `${idsToDelete.length} media berhasil dihapus`
      });

      setShowDeleteConfirm(null);
      setSelectedIds(new Set());
      await fetchPhotos();

      if (onSuccess) onSuccess();

      setTimeout(() => setDeleteStatus(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setDeleteStatus({
        type: 'error',
        message: error.message || 'Gagal menghapus media'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !loadingData) return null;

  const isPerawatan = loadingData.type === 'perawatan';

  const createdDate = loadingData.created_at || loadingData.createdAt;
  const formattedCreatedDate = createdDate 
    ? new Date(createdDate).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';

  const handleDownloadZip = async () => {
    if (isDownloading || photos.length === 0) return;
    
    setIsDownloading(true);
    setDownloadStatus({ type: 'loading', message: 'Mempersiapkan download...' });
    
    try {
      const result = await downloadPhotosAsZip(
        photos.map(photo => photo.url),
        loadingData.companyName,
        loadingData.date,
        loadingData.pic
      );
      
      setDownloadStatus({
        type: 'success',
        message: `Berhasil! ${result.downloaded} media diunduh sebagai ${result.fileName}`
      });
      
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (error) {
      console.error('Download error:', error);
      setDownloadStatus({
        type: 'error',
        message: error.message || 'Gagal mengunduh foto'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className={`
        relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh]
        bg-white sm:rounded-3xl rounded-t-3xl
        shadow-2xl overflow-hidden
        animate-slide-up flex flex-col
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between px-6 py-4 border-b
          ${isPerawatan ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isPerawatan ? 'bg-blue-100' : 'bg-garden/10'}
            `}>
              {isPerawatan ? (
                <Sparkles className="w-5 h-5 text-blue-600" />
              ) : (
                <Image className="w-5 h-5 text-garden" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {isPerawatan ? 'Detail Perawatan' : 'Detail Loading'}
                </h2>
                {isPerawatan && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    Perawatan
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">ID: #{loadingData.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="
              w-10 h-10 rounded-full bg-gray-100 
              flex items-center justify-center
              hover:bg-gray-200 active:scale-95
              transition-all duration-200
            "
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Cards */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <div className={`p-4 rounded-xl border ${isPerawatan ? 'bg-blue-50 border-blue-100' : 'bg-garden/5 border-garden/10'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className={`w-4 h-4 ${isPerawatan ? 'text-blue-600' : 'text-garden'}`} />
                <span className="text-xs font-medium text-gray-500 uppercase">Perusahaan</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{loadingData.companyName}</p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {isPerawatan ? 'Tanggal Perawatan' : 'Tanggal Rotasi'}
                </span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {new Date(loadingData.date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {isPerawatan ? 'Perawatan Oleh' : 'PIC Loading'}
                </span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{loadingData.pic}</p>
              {Array.isArray(loadingData.crew) && loadingData.crew.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {loadingData.crew.map((m) => (
                    <span key={m.id} className="text-xs px-2 py-1 rounded-full bg-white border border-purple-200 text-purple-700 font-medium">
                      {m.name || m.username}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">Jumlah Media</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{loadingData.photo_count || loadingData.photoCount || 0} media dokumentasi</p>
            </div>
          </div>

          {/* Created At */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 p-3 rounded-xl bg-gray-50">
            <Clock className="w-4 h-4" />
            <span>Input pada: {formattedCreatedDate}</span>
          </div>

          {/* Catatan */}
          <div className={`mb-6 p-4 rounded-xl border ${isPerawatan ? 'bg-blue-50/50 border-blue-100' : 'bg-garden/5 border-garden/10'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPerawatan ? 'bg-blue-100' : 'bg-garden/10'}`}>
                <FileText className={`w-4 h-4 ${isPerawatan ? 'text-blue-600' : 'text-garden'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-gray-500 uppercase block mb-1">Catatan</span>
                <p className="text-sm text-gray-800 break-words">
                  {loadingData.catatan || 'Catatan : -'}
                </p>
              </div>
            </div>
          </div>

          {/* Delete Status */}
          {deleteStatus && (
            <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm ${
              deleteStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {deleteStatus.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{deleteStatus.message}</span>
            </div>
          )}

          {/* Download & Delete Actions */}
          {photos.length > 0 && (
            <div className={`
              mb-6 p-4 rounded-xl border
              ${isPerawatan 
                ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200' 
                : 'bg-gradient-to-r from-garden/5 to-blue-50 border-garden/10'}
            `}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isPerawatan ? 'bg-blue-100' : 'bg-garden/10'}
                  `}>
                    <Archive className={`w-5 h-5 ${isPerawatan ? 'text-blue-600' : 'text-garden'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Download Semua Media</p>
                    <p className="text-xs text-gray-500">Format ZIP ({photos.length} media)</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm flex-shrink-0
                    transition-all duration-200
                    ${isDownloading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : isPerawatan
                        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20'
                        : 'bg-garden text-white hover:bg-garden-dark shadow-lg shadow-garden/20'
                    }
                  `}
                >
                  {isDownloading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Menyiapkan...</span></>
                  ) : (
                    <><Download className="w-4 h-4" /><span>Download ZIP</span></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Photos Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Image className={`w-5 h-5 ${isPerawatan ? 'text-blue-600' : 'text-garden'}`} />
                Media Dokumentasi {isPerawatan ? 'Perawatan' : 'Rotasi'}
              </h3>
              {photos.length > 0 && selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus ({selectedIds.size})
                </button>
              )}
            </div>
            
            {isLoadingPhotos ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Memuat media...</p>
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => {
                  const isSelected = selectedIds.has(photo.id);
                  return (
                    <div 
                      key={photo.id}
                      className={`
                        aspect-square rounded-xl overflow-hidden
                        border-2 transition-all duration-200 group relative
                        ${isSelected
                          ? 'border-red-500 ring-2 ring-red-500/30'
                          : isPerawatan ? 'border-transparent hover:border-blue-500' : 'border-transparent hover:border-garden'
                        }
                      `}
                    >
                      {/* Click to view fullscreen */}
                      <div
                        className="absolute inset-0 cursor-pointer z-0"
                        onClick={() => setLightboxIndex(index)}
                      >
                        {photo.mediaType === 'video' ? (
                          <>
                            <video
                              src={photo.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
                                <Video className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={photo.url}
                            alt={`Media ${index + 1}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                        )}
                      </div>

                      {/* Index Badge */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-xs font-medium z-10">
                        {index + 1}
                      </div>

                      {/* Select Checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10 hover:bg-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-500" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600" />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSingle(photo); }}
                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10 hover:bg-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">Tidak ada media</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Tutup
          </button>
        </div>

        {/* Photo Lightbox */}
        {lightboxIndex !== null && photos.length > 0 && (
          <Lightbox
            items={photos.map(p => ({ url: p.url, mediaType: p.mediaType, filename: p.filename }))}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndex={setLightboxIndex}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Media?</h3>
                <p className="text-gray-500 text-sm">
                  {showDeleteConfirm.type === 'single'
                    ? 'Apakah Anda yakin ingin menghapus media ini?'
                    : `Apakah Anda yakin ingin menghapus ${showDeleteConfirm.ids.size} media yang dipilih?`
                  }
                  <br />
                  <span className="text-red-500 text-xs">Tindakan ini tidak dapat dibatalkan.</span>
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
                  onClick={confirmDelete}
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

      </div>
    </div>
  );
};

export default LoadingDetailModal;
