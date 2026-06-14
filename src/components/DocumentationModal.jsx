import React, { useState, useRef, useEffect } from 'react';
import { toast } from '../utils/toast';
import {
  X, Calendar, User, Building2, Camera, Video,
  Upload, Trash2, Loader2, CheckCircle2, AlertCircle,
  XCircle, WifiOff, FileText, Sparkles
} from 'lucide-react';
import { getTodayDate, formatDate } from '../utils/date';
import { uploadMultipleToS3 } from '../utils/s3Config';
import { addLoadingHistory, addPhotos } from '../utils/supabase';
import { compressMultipleImages, formatFileSize, calculateSavings } from '../utils/imageCompression';
import { logError, trackUploadAttempt, ERROR_TYPES } from '../utils/errorTracking';
import { createMediaItemsFromFiles, formatDuration, getMediaUploadSuccessMessage } from '../utils/media';

const CONFIG = {
  loading: {
    title: 'Input Loading',
    picLabel: 'Nama Yang Upload Foto',
    picPlaceholder: 'Nama yang upload foto...',
    mediaLabel: 'Bukti Foto/Video Rotasi',
    submitLabel: 'Simpan Loading',
    headerIcon: Upload,
    headerIconBg: 'bg-garden/10',
    headerIconColor: 'text-garden',
    accentColor: 'garden',
    inputBg: 'bg-garden/5',
    inputBorder: 'border-garden/20',
    companyIconColor: 'text-garden',
    borderFocus: 'focus:border-garden focus:ring-garden/10',
    progressBarGradient: 'from-garden to-garden-dark',
    savingBg: 'bg-garden/20',
    savingIconColor: 'text-garden',
    buttonGradient: 'from-garden to-garden-dark',
    buttonShadow: 'shadow-garden/30 hover:shadow-garden/40',
    uploadIconBg: 'bg-garden/10',
    uploadIconColor: 'text-garden',
    hoverBorder: 'hover:border-garden hover:bg-garden/5',
    duplicateType: 'loading',
    duplicateMsg: 'Sudah ada data loading untuk perusahaan ini pada tanggal yang sama.',
    errorContextType: 'loading',
  },
  perawatan: {
    title: 'Input Perawatan',
    picLabel: 'Nama Yang Upload Foto',
    picPlaceholder: 'Nama yang upload foto...',
    mediaLabel: 'Bukti Foto/Video Perawatan',
    submitLabel: 'Simpan Perawatan',
    headerIcon: Sparkles,
    headerIconBg: 'bg-blue-100',
    headerIconColor: 'text-blue-600',
    accentColor: 'blue-500',
    inputBg: 'bg-blue-50',
    inputBorder: 'border-blue-200',
    companyIconColor: 'text-blue-600',
    borderFocus: 'focus:border-blue-500 focus:ring-blue-500/10',
    progressBarGradient: 'bg-blue-500',
    savingBg: 'bg-blue-50',
    savingIconColor: 'text-blue-600',
    buttonGradient: 'from-blue-500 to-blue-600',
    buttonShadow: 'shadow-blue-500/30 hover:shadow-blue-500/40',
    uploadIconBg: 'bg-blue-100',
    uploadIconColor: 'text-blue-600',
    hoverBorder: 'hover:border-blue-500 hover:bg-blue-50',
    duplicateType: 'perawatan',
    duplicateMsg: 'Sudah ada data perawatan untuk perusahaan ini pada tanggal yang sama.',
    errorContextType: 'perawatan',
  }
};

const DocumentationModal = ({ isOpen, onClose, companyName, companyId, onSuccess, checkDuplicate, type = 'loading' }) => {
  const cfg = CONFIG[type] || CONFIG.loading;

  const [date, setDate] = useState(getTodayDate());
  const [pic, setPic] = useState('');
  const [photos, setPhotos] = useState([]);
  const [catatan, setCatatan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [compressionStats, setCompressionStats] = useState(null);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setDate(getTodayDate());
      setPic('');
      setPhotos([]);
      setCatatan('');
      setUploadProgress(0);
      setUploadStatus('');
      setErrorMessage('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        if (!isSubmitting) onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, isSubmitting]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const { items: newPhotos, errors } = await createMediaItemsFromFiles(files);

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (newPhotos.length === 0) return;

    setPhotos(prev => [...prev, ...newPhotos]);

    const imagePhotos = newPhotos.filter(item => item.mediaType === 'image');
    if (imagePhotos.length === 0) return;

    const compressedPhotos = await compressMultipleImages(imagePhotos, null, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.9
    });

    setPhotos(prev => {
      const updated = [...prev];
      compressedPhotos.forEach(compressed => {
        const index = updated.findIndex(p => p.id === compressed.id);
        if (index !== -1) {
          updated[index] = {
            ...compressed,
            size: (compressed.compressedSize / 1024 / 1024).toFixed(2),
            isCompressing: false
          };
        }
      });
      return updated;
    });
  };

  const handleDeletePhoto = (photoId) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== photoId);
    });
  };

  const handleSubmit = async () => {
    if (!date || !pic || photos.length === 0 || !companyId) return;

    if (checkDuplicate) {
      const isDuplicate = await checkDuplicate(date, cfg.duplicateType);
      if (isDuplicate) {
        const confirmed = window.confirm(
          `${cfg.duplicateMsg}\n\nApakah Anda yakin ingin menambahkan data lagi?`
        );
        if (!confirmed) return;
      }
    }

    setIsSubmitting(true);
    setUploadStatus('compressing');
    setUploadProgress(0);
    setErrorMessage('');
    setCompressionStats(null);

    let totalOriginal = photos.reduce((sum, p) => sum + (p.originalSize || p.file.size), 0);
    let totalCompressed = totalOriginal;

    try {
      setUploadStatus('compressing');
      const uncompressedPhotos = photos.filter(p => p.isCompressing || !p.compressedSize);
      const alreadyCompressed = photos.filter(p => !p.isCompressing && p.compressedSize);

      let allPhotos = [...alreadyCompressed];

      if (uncompressedPhotos.length > 0) {
        const compressed = await compressMultipleImages(
          uncompressedPhotos,
          (done, total) => setUploadProgress(Math.round((done / total) * 30)),
          { maxWidth: 1920, maxHeight: 1920, quality: 0.9 }
        );
        allPhotos = [...alreadyCompressed, ...compressed];
      }

      totalOriginal = allPhotos.reduce((sum, p) => sum + (p.originalSize || p.file.size), 0);
      totalCompressed = allPhotos.reduce((sum, p) => sum + (p.compressedSize || p.file.size), 0);
      setCompressionStats({
        original: totalOriginal,
        compressed: totalCompressed,
        saved: totalOriginal - totalCompressed,
        percentage: ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(0)
      });

      setUploadStatus('uploading');
      const totalPhotos = allPhotos.length;
      let completedPhotos = 0;

      const progressInterval = setInterval(() => {
        if (completedPhotos < totalPhotos) {
          const progress = 30 + Math.min(
            Math.round(((completedPhotos + 0.5) / totalPhotos) * 40),
            39
          );
          setUploadProgress(progress);
        }
      }, 300);

      const uploadedPhotos = await uploadMultipleToS3(allPhotos, companyName, date, type);

      clearInterval(progressInterval);
      completedPhotos = totalPhotos;
      setUploadProgress(70);

      setUploadStatus('saving');
      setUploadProgress(80);

      const historyData = {
        company_id: companyId,
        date: date,
        pic: pic.trim(),
        type: type,
        photo_count: photos.length,
        catatan: catatan.trim() || null
      };

      const savedHistory = await addLoadingHistory(historyData);

      const photoRecords = uploadedPhotos.map((photo, index) => ({
        history_id: savedHistory.id,
        url: photo.url,
        filename: photo.name,
        size_bytes: photo.size,
        sort_order: index + 1
      }));

      await addPhotos(photoRecords);
      setUploadProgress(100);

      setUploadStatus('success');

      trackUploadAttempt(true, {
        photoCount: photos.length,
        totalSize: totalCompressed,
        compressionRatio: parseFloat(((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(2))
      });

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error(`Error submitting ${type}:`, error);
      setUploadStatus('error');
      setErrorMessage(
        error.message || 'Terjadi kesalahan saat mengupload data. Silakan coba lagi.'
      );

      let errorType = ERROR_TYPES.OTHER;
      if (error.message?.includes('upload') || error.message?.includes('S3')) {
        errorType = ERROR_TYPES.UPLOAD;
      } else if (error.message?.includes('compress')) {
        errorType = ERROR_TYPES.COMPRESSION;
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorType = ERROR_TYPES.NETWORK;
      } else if (error.message?.includes('database') || error.message?.includes('supabase')) {
        errorType = ERROR_TYPES.DATABASE;
      }

      logError({
        type: errorType,
        message: error.message || `${type} upload failed`,
        companyId,
        context: {
          photoCount: photos.length,
          uploadStatus,
          companyName,
          type
        }
      });

      trackUploadAttempt(false, {
        photoCount: photos.length,
        totalSize: totalOriginal
      });

      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setUploadStatus('');
    setErrorMessage('');
    setUploadProgress(0);
    setIsSubmitting(false);
  };

  const isFormValid = date && pic.trim() && photos.length > 0 && companyId;
  const successMessage = getMediaUploadSuccessMessage(photos);
  const HeaderIcon = cfg.headerIcon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col"
      >
        {isSubmitting && uploadStatus !== 'error' && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-xs">
              <div className="flex justify-center mb-6">
                {uploadStatus === 'compressing' && (
                  <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                  </div>
                )}
                {uploadStatus === 'uploading' && (
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <Upload className="w-10 h-10 text-blue-600 animate-bounce" />
                  </div>
                )}
                {uploadStatus === 'saving' && (
                  <div className={`w-20 h-20 rounded-full ${cfg.savingBg} flex items-center justify-center`}>
                    <Loader2 className={`w-10 h-10 ${cfg.savingIconColor} animate-spin`} />
                  </div>
                )}
                {uploadStatus === 'success' && (
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                {uploadStatus === 'compressing' && 'Menyiapkan Media...'}
                {uploadStatus === 'uploading' && 'Mengupload Media...'}
                {uploadStatus === 'saving' && 'Menyimpan Data...'}
                {uploadStatus === 'success' && successMessage}
              </h3>

              <p className="text-gray-500 text-center text-sm mb-6">
                {uploadStatus === 'compressing' && 'Mengompres foto dan memvalidasi video max 1 menit'}
                {uploadStatus === 'uploading' && `Mengupload ${photos.length} media ke server`}
                {uploadStatus === 'saving' && 'Menyimpan data ke database'}
                {uploadStatus === 'success' && compressionStats && (
                  <>
                    {compressionStats.saved > 0
                      ? `Hemat ${formatFileSize(compressionStats.saved)} (${compressionStats.percentage}%)`
                      : 'Video disimpan original agar kualitas tetap'}
                  </>
                )}
              </p>

              <div className="relative">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      uploadStatus === 'success'
                        ? 'bg-green-500'
                        : `bg-gradient-to-r ${cfg.progressBarGradient}`
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-gray-700 mt-2">
                  {uploadProgress}%
                </p>
              </div>

              {uploadStatus === 'uploading' && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  Mohon tunggu, jangan tutup halaman ini
                </p>
              )}
            </div>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <WifiOff className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Gagal</h3>
            <p className="text-gray-500 text-center mb-6">
              {errorMessage}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => onClose()}
                className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handleRetry}
                className={`px-6 py-3 rounded-xl bg-gradient-to-r ${cfg.buttonGradient} text-white font-medium hover:shadow-lg transition-all`}
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${cfg.headerIconBg} flex items-center justify-center`}>
              <HeaderIcon className={`w-5 h-5 ${cfg.headerIconColor}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{cfg.title}</h2>
              <p className="text-xs text-gray-500">{formatDate(date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nama Perusahaan
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className={`w-5 h-5 ${cfg.companyIconColor}`} />
              </div>
              <input
                type="text"
                value={companyName}
                readOnly
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl ${cfg.inputBg} border-2 ${cfg.inputBorder} text-gray-800 font-semibold focus:outline-none cursor-default`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isSubmitting}
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium focus:outline-none ${cfg.borderFocus} transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {cfg.picLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder={cfg.picPlaceholder}
                disabled={isSubmitting}
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none ${cfg.borderFocus} transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {cfg.mediaLabel} <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-500 ml-2">
                ({photos.length} media)
              </span>
            </label>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 ${cfg.hoverBorder} active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className={`w-12 h-12 rounded-full ${cfg.uploadIconBg} flex items-center justify-center`}>
                <Camera className={`w-6 h-6 ${cfg.uploadIconColor}`} />
              </div>
              <span className="text-sm font-medium text-gray-600">
                Tap untuk upload foto/video
              </span>
              <span className="text-xs text-gray-400">
                Video max 1 menit, kualitas tetap original
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              disabled={isSubmitting}
              className="hidden"
            />

            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-xl overflow-hidden group"
                  >
                    {photo.mediaType === 'video' ? (
                      <>
                        <video
                          src={photo.preview}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                            <Video className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={photo.preview}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                      <span className="text-xs text-white font-medium">{index + 1}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={isSubmitting}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 active:scale-90 transition-all duration-200 shadow-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <span className="text-[10px] text-white">
                        {photo.isCompressing ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="w-2 h-2 animate-spin" />
                            compress...
                          </span>
                        ) : (
                          <>
                            {photo.size} MB
                            {photo.mediaType === 'video' && photo.duration !== null && (
                              <span className="ml-1">({formatDuration(photo.duration)})</span>
                            )}
                            {photo.originalSize && photo.compressedSize && photo.compressedSize < photo.originalSize && (
                              <span className="text-green-300 ml-1">
                                (-{calculateSavings(photo.originalSize, photo.compressedSize)})
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catatan <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <div className="relative">
              <div className="absolute top-3.5 left-4 flex items-start pointer-events-none">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Masukkan catatan jika diperlukan..."
                disabled={isSubmitting}
                rows={3}
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none ${cfg.borderFocus} transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none`}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              isFormValid && !isSubmitting
                ? `bg-gradient-to-r ${cfg.buttonGradient} text-white shadow-lg ${cfg.buttonShadow} hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>{cfg.submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
