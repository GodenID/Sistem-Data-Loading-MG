import { uploadMultipleToS3, deleteFromS3 } from './s3Config';
import { addLoadingHistory, addPhotos } from './supabase';
import { compressMultipleImages } from './imageCompression';
import { logError, trackUploadAttempt, ERROR_TYPES } from './errorTracking';

/**
 * Inti pipeline upload dokumentasi — dipindah dari DocumentationModal
 * agar bisa dijalankan background (UploadQueue) tanpa mengunci layar.
 *
 * @param {Object} job
 * @param {Array} job.files - media items dari createMediaItemsFromFiles
 * @param {number} job.companyId
 * @param {string} job.companyName
 * @param {string} job.date - YYYY-MM-DD
 * @param {string} job.pic
 * @param {'loading'|'perawatan'} job.type
 * @param {string|null} job.catatan
 * @param {(status: 'compressing'|'uploading'|'saving', progress: number) => void} onProgress
 * @returns {Promise<{historyId: number, photoCount: number}>}
 */
export const processUpload = async (
  { files, companyId, companyName, date, pic, type, catatan },
  onProgress
) => {
  const emit = (status, progress) => {
    try { onProgress?.(status, progress); } catch { /* abaikan */ }
  };

  let totalOriginal = files.reduce((sum, p) => sum + (p.originalSize || p.file.size), 0);
  let totalCompressed = totalOriginal;

  try {
    // Tahap 1: kompresi (0-30%)
    emit('compressing', 0);
    const uncompressedPhotos = files.filter(p => p.isCompressing || !p.compressedSize);
    const alreadyCompressed = files.filter(p => !p.isCompressing && p.compressedSize);

    let allPhotos = [...alreadyCompressed];
    if (uncompressedPhotos.length > 0) {
      const compressed = await compressMultipleImages(
        uncompressedPhotos,
        (done, total) => emit('compressing', Math.round((done / total) * 30)),
        { maxWidth: 1920, maxHeight: 1920, quality: 0.9 }
      );
      allPhotos = [...alreadyCompressed, ...compressed];
    }

    totalOriginal = allPhotos.reduce((sum, p) => sum + (p.originalSize || p.file.size), 0);
    totalCompressed = allPhotos.reduce((sum, p) => sum + (p.compressedSize || p.file.size), 0);

    // Tahap 2: upload S3 (30-70%)
    emit('uploading', 30);
    const totalPhotos = allPhotos.length;
    let completedPhotos = 0;
    const progressInterval = setInterval(() => {
      if (completedPhotos < totalPhotos) {
        emit('uploading', 30 + Math.min(
          Math.round(((completedPhotos + 0.5) / totalPhotos) * 40),
          39
        ));
      }
    }, 300);

    let uploadedPhotos;
    try {
      uploadedPhotos = await uploadMultipleToS3(allPhotos, companyName, date, type);
    } finally {
      clearInterval(progressInterval);
    }
    completedPhotos = totalPhotos;
    emit('uploading', 70);

    // Tahap 3: simpan DB (80-100%)
    emit('saving', 80);
    const historyData = {
      company_id: companyId,
      date,
      pic,
      type,
      photo_count: files.length,
      catatan: catatan || null
    };

    let savedHistory;
    try {
      savedHistory = await addLoadingHistory(historyData);

      const photoRecords = uploadedPhotos.map((photo, index) => ({
        history_id: savedHistory.id,
        url: photo.url,
        filename: photo.name,
        size_bytes: photo.size,
        sort_order: index + 1
      }));

      await addPhotos(photoRecords);
    } catch (dbError) {
      // Insert gagal (mis. duplikat lolos cek karena race) -> bersihkan
      // file yang sudah terupload agar tidak jadi orphan di S3.
      await Promise.all(
        (uploadedPhotos || []).map(async (p) => {
          try { await deleteFromS3(p.url); } catch { /* abaikan */ }
        })
      );
      throw dbError;
    }

    emit('saving', 100);

    trackUploadAttempt(true, {
      photoCount: files.length,
      totalSize: totalCompressed,
      compressionRatio: totalOriginal > 0
        ? parseFloat(((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(2))
        : 0
    });

    return { historyId: savedHistory.id, photoCount: files.length };
  } catch (error) {
    console.error(`Error background upload ${type}:`, error);

    let errorType = ERROR_TYPES.OTHER;
    if (error.message?.includes('upload') || error.message?.includes('S3')) {
      errorType = ERROR_TYPES.UPLOAD;
    } else if (error.message?.includes('compress')) {
      errorType = ERROR_TYPES.COMPRESSION;
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      errorType = ERROR_TYPES.NETWORK;
    } else if (error.message?.includes('database') || error.message?.includes('API')) {
      errorType = ERROR_TYPES.DATABASE;
    }

    logError({
      type: errorType,
      message: error.message || `${type} upload failed`,
      companyId,
      context: { photoCount: files.length, companyName, type, background: true }
    });

    trackUploadAttempt(false, {
      photoCount: files.length,
      totalSize: totalOriginal
    });

    throw error;
  }
};
