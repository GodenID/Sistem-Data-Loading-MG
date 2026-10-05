import React, { useState, useRef, useEffect } from 'react';
import { toast } from '../utils/toast';
import { 
  X, 
  Calendar, 
  User, 
  Building2, 
  Camera, 
  Video,
  Upload, 
  Trash2, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  WifiOff,
  Pencil
} from 'lucide-react';
import { formatDate } from '../utils/date';
import { uploadMultipleToS3, deleteFromS3 } from '../utils/s3Config';
import { updateLoadingHistory, updatePhotos, getPhotosByHistoryId, checkLoadingDuplicate, getHistoryCrew, setHistoryCrew } from '../utils/supabase';
import { createMediaItemsFromFiles, formatDuration, getMediaTypeFromUrl, getMediaUploadSuccessMessage } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import CrewPicker from './CrewPicker';

const EditLoadingModal = ({ isOpen, onClose, loadingData, onSuccess }) => {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [pic, setPic] = useState('');
  const [crew, setCrew] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [photosToDelete, setPhotosToDelete] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && loadingData) {
      setDate(loadingData.date || '');
      setPic(loadingData.pic || user?.name || '');
      setNewPhotos([]);
      setPhotosToDelete([]);
      setUploadProgress(0);
      setUploadStatus('');
      setErrorMessage('');
      
      // Fetch existing photos + tim
      fetchExistingPhotos();
      getHistoryCrew(loadingData.id)
        .then(setCrew)
        .catch(() => setCrew([]));
    }
  }, [isOpen, loadingData]);

  const fetchExistingPhotos = async () => {
    try {
      const photos = await getPhotosByHistoryId(loadingData.id);
      setExistingPhotos(photos);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setExistingPhotos([]);
    }
  };

  // Handle click outside to close
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

    const { items: photos, errors } = await createMediaItemsFromFiles(files);

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (photos.length === 0) return;

    setNewPhotos(prev => [...prev, ...photos]);
  };

  const handleDeleteExistingPhoto = (photo) => {
    setPhotosToDelete(prev => [...prev, photo]);
    setExistingPhotos(prev => prev.filter(p => p.id !== photo.id));
  };

  const handleDeleteNewPhoto = (photoId) => {
    setNewPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== photoId);
    });
  };

  const handleSubmit = async () => {
    if (!date || !pic) return;

    // Jika tanggal diubah, pastikan tidak menabrak data lain (UNIQUE company,date,type)
    if (date !== loadingData.date) {
      try {
        const clash = await checkLoadingDuplicate(
          loadingData.company_id, date, loadingData.type, loadingData.id
        );
        if (clash) {
          setUploadStatus('error');
          setErrorMessage(
            loadingData.type === 'perawatan'
              ? 'Sudah ada data perawatan untuk perusahaan ini pada tanggal tersebut.'
              : 'Sudah ada data loading untuk perusahaan ini pada tanggal tersebut.'
          );
          setIsSubmitting(false);
          return;
        }
      } catch (e) {
        console.warn('Gagal cek duplikat saat edit:', e?.message);
      }
    }

    if (photosToDelete.length > 0) {
      const confirmed = window.confirm(
        `Apakah Anda yakin ingin menghapus ${photosToDelete.length} foto yang ditandai?\n\nTindakan ini tidak dapat dibatalkan.`
      );
      if (!confirmed) return;
    }

    const totalPhotos = existingPhotos.length + newPhotos.length;

    setIsSubmitting(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      // Step 1: Delete photos from S3 that are marked for deletion
      if (photosToDelete.length > 0) {
        for (const photo of photosToDelete) {
          try {
            await deleteFromS3(photo.url);
          } catch (e) {
            console.warn('Failed to delete photo from S3:', e);
          }
        }
      }

      setUploadProgress(20);

      // Step 2: Upload new photos to S3
      let uploadedNewPhotos = [];
      if (newPhotos.length > 0) {
        const companyName = loadingData.companyName || 'Unknown';
        const type = loadingData.type || 'loading';
        uploadedNewPhotos = await uploadMultipleToS3(newPhotos, companyName, date, type);
      }

      setUploadProgress(50);
      setUploadStatus('saving');

      // Step 3: Update loading history record
      const historyUpdates = {
        date: date,
        pic: pic.trim(),
        photo_count: totalPhotos
      };

      await updateLoadingHistory(loadingData.id, historyUpdates);
      setUploadProgress(70);

      // Step 4: Prepare all photo records
      const existingPhotoRecords = existingPhotos.map((photo, index) => ({
        history_id: loadingData.id,
        url: photo.url,
        filename: photo.filename || `photo-${index + 1}.jpg`,
        size_bytes: photo.size_bytes || null,
        sort_order: index + 1
      }));

      const newPhotoRecords = uploadedNewPhotos.map((photo, index) => ({
        history_id: loadingData.id,
        url: photo.url,
        filename: photo.name,
        size_bytes: photo.size,
        sort_order: existingPhotos.length + index + 1
      }));

      // Step 5: Update photos in database
      await updatePhotos(loadingData.id, [...existingPhotoRecords, ...newPhotoRecords]);

      // Step 6: Update tim
      try {
        await setHistoryCrew(loadingData.id, crew.map((c) => c.id));
      } catch (e) {
        console.warn('Gagal simpan tim:', e?.message);
      }
      setUploadProgress(100);

      // Success
      setUploadStatus('success');
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error updating:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Terjadi kesalahan saat menyimpan data');
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setUploadStatus('');
    setErrorMessage('');
    setUploadProgress(0);
    setIsSubmitting(false);
  };

  const isFormValid = date && pic.trim();
  const successMessage = newPhotos.length > 0
    ? getMediaUploadSuccessMessage(newPhotos)
    : 'Data berhasil diperbarui';

  if (!isOpen || !loadingData) return null;

  const isPerawatan = loadingData.type === 'perawatan';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="
          relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh]
          bg-white sm:rounded-3xl rounded-t-3xl
          shadow-2xl overflow-hidden
          animate-slide-up flex flex-col
        "
      >
        {/* Loading/Progress Overlay */}
        {isSubmitting && uploadStatus !== 'error' && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-xs">
              <div className="flex justify-center mb-6">
                {uploadStatus === 'uploading' && (
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <Upload className="w-10 h-10 text-blue-600 animate-bounce" />
                  </div>
                )}
                {uploadStatus === 'saving' && (
                  <div className="w-20 h-20 rounded-full bg-garden/20 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-garden animate-spin" />
                  </div>
                )}
                {uploadStatus === 'success' && (
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                {uploadStatus === 'uploading' && 'Mengupload Media...'}
                {uploadStatus === 'saving' && 'Menyimpan Data...'}
                {uploadStatus === 'success' && successMessage}
              </h3>
              
              <p className="text-gray-500 text-center text-sm mb-6">
                {uploadStatus === 'uploading' && `Mengupload ${newPhotos.length} media baru`}
                {uploadStatus === 'saving' && 'Menyimpan perubahan ke database'}
                {uploadStatus === 'success' && successMessage}
              </p>

              <div className="relative">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      uploadStatus === 'success' ? 'bg-green-500' : 'bg-gradient-to-r from-garden to-garden-dark'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-gray-700 mt-2">{uploadProgress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {uploadStatus === 'error' && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <WifiOff className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Gagal</h3>
            <p className="text-gray-500 text-center mb-6">{errorMessage}</p>
            <div className="flex gap-3">
              <button onClick={() => onClose()} className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">
                Tutup
              </button>
              <button onClick={handleRetry} className="px-6 py-3 rounded-xl bg-garden text-white font-medium hover:bg-garden-dark">
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isPerawatan ? 'bg-blue-100' : 'bg-garden/10'} flex items-center justify-center`}>
              <Pencil className={`w-5 h-5 ${isPerawatan ? 'text-blue-600' : 'text-garden'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit {isPerawatan ? 'Perawatan' : 'Loading'}</h2>
              <p className="text-xs text-gray-500">{formatDate(date)}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 disabled:opacity-50">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Company Name (Read Only) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Perusahaan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="w-5 h-5 text-garden" />
              </div>
              <input
                type="text"
                value={loadingData.companyName}
                readOnly
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-garden/5 border-2 border-garden/20 text-gray-800 font-semibold cursor-default"
              />
            </div>
          </div>

          {/* Date Picker */}
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
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* PIC */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isPerawatan ? 'Perawatan Oleh' : 'PIC Loading'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder={`Masukkan nama ${isPerawatan ? 'yang melakukan perawatan' : 'PIC'}...`}
                disabled={isSubmitting}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Tim */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tim Yang Bertugas <span className="text-xs font-normal text-gray-500">(cari nama, bisa banyak)</span>
            </label>
            <CrewPicker value={crew} onChange={setCrew} />
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Foto/Video Dokumentasi <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-500 ml-2">
                ({existingPhotos.length + newPhotos.length} media)
              </span>
            </label>
            
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:border-garden hover:bg-garden/5 transition-all disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full bg-garden/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-garden" />
              </div>
              <span className="text-sm font-medium text-gray-600">Tambah foto/video baru</span>
              <span className="text-xs text-gray-400">Video max 1 menit, kualitas tetap original</span>
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

            {/* Existing Media Grid */}
            {existingPhotos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Media yang sudah ada:</p>
                <div className="grid grid-cols-3 gap-3">
                  {existingPhotos.map((photo, index) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                      {getMediaTypeFromUrl(photo.url, photo.filename) === 'video' ? (
                        <>
                          <video src={photo.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <img src={photo.url} alt={`Media ${index + 1}`} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => handleDeleteExistingPhoto(photo)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Media Grid */}
            {newPhotos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Media baru:</p>
                <div className="grid grid-cols-3 gap-3">
                  {newPhotos.map((photo, index) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                      {photo.mediaType === 'video' ? (
                        <>
                          <video src={photo.preview} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <img src={photo.preview} alt={photo.name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-garden/80 flex items-center justify-center text-white text-xs font-medium">
                        {existingPhotos.length + index + 1}
                      </div>
                      <button
                        onClick={() => handleDeleteNewPhoto(photo.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                        <span className="text-[10px] text-white">
                          {photo.size} MB
                          {photo.mediaType === 'video' && photo.duration !== null && (
                            <span className="ml-1">({formatDuration(photo.duration)})</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              isFormValid && !isSubmitting
                ? 'bg-gradient-to-r from-garden to-garden-dark text-white shadow-lg shadow-garden/30 hover:shadow-xl hover:shadow-garden/40 hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /><span>Menyimpan...</span></>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /><span>Simpan Perubahan</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLoadingModal;
