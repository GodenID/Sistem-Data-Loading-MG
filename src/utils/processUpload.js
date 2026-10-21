import { uploadMultipleToS3, deleteFromS3 } from './s3Config';
import { addLoadingHistory, addPhotos, setHistoryCrew, findLoadingDuplicate } from './supabase';
import { compressMultipleImages } from './imageCompression';
import { logError, trackUploadAttempt, ERROR_TYPES } from './errorTracking';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Error "ambigu": respons tidak pernah sampai (jaringan putus/timeout/proxy 5xx),
// jadi server MUNGKIN sudah menyimpan datanya.
const isAmbiguous = (err) => !!err?.network || (typeof err?.status === 'number' && err.status >= 500);

/**
 * Setelah request simpan history gagal ambigu / bentrok saat retry, cek apakah
 * baris yang ada ternyata hasil request kita sendiri (pic sama & dibuat sejak
 * percobaan pertama job ini). Kalau iya, pakai ulang — JANGAN buat baru.
 */
const adoptOwnHistory = async ({ companyId, date, type, pic }, resume) => {
  try {
    const rec = await findLoadingDuplicate(companyId, date, type);
    if (!rec) return null;
    const samePic = String(rec.pic || '').trim().toLowerCase() === String(pic || '').trim().toLowerCase();
    const createdAt = rec.created_at ? new Date(rec.created_at).getTime() : 0;
    const since = (resume.historyAttemptedAt || 0) - 60 * 1000; // toleransi selisih jam
    return samePic && createdAt >= since ? rec : null;
  } catch {
    return null;
  }
};

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
 * @param {number[]} job.crewIds - id user tim (opsional)
 * @param {(status: 'compressing'|'uploading'|'saving', progress: number) => void} onProgress
 * @param {Object} resume - state mutable milik job; menyimpan progres antar retry
 *   (uploadedPhotos, historyId) supaya retry MELANJUTKAN, bukan membuat data baru.
 * @returns {Promise<{historyId: number, photoCount: number}>}
 */
export const processUpload = async (
  { files, companyId, companyName, date, pic, type, catatan, crewIds = [] },
  onProgress,
  resume = {}
) => {
  const emit = (status, progress) => {
    try { onProgress?.(status, progress); } catch { /* abaikan */ }
  };

  let totalOriginal = files.reduce((sum, p) => sum + (p.originalSize || p.file.size), 0);
  let totalCompressed = totalOriginal;

  try {
    let uploadedPhotos = resume.uploadedPhotos;

    if (!uploadedPhotos) {
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

      try {
        uploadedPhotos = await uploadMultipleToS3(allPhotos, companyName, date, type);
      } finally {
        clearInterval(progressInterval);
      }
      completedPhotos = totalPhotos;
      resume.uploadedPhotos = uploadedPhotos; // simpan: retry tidak upload ulang
    }
    emit('uploading', 70);

    // Tahap 3: simpan DB (80-100%)
    emit('saving', 80);
    const historyData = {
      company_id: companyId,
      date,
      pic,
      type,
      photo_count: files.length,
      catatan: catatan || null,
      // Dikirim sekalian agar notifikasi Telegram langsung bawa nama tim.
      // (Di bawah tetap dipanggil setHistoryCrew sebagai pengaman.)
      crew: crewIds,
    };

    try {
      // 3a. Buat history — hanya SEKALI per job. Kalau sudah pernah berhasil
      // (resume.historyId), lewati supaya retry tidak membuat baris baru.
      if (!resume.historyId) {
        const retrying = !!resume.historyAttemptedAt;
        if (!resume.historyAttemptedAt) resume.historyAttemptedAt = Date.now();
        try {
          const saved = await addLoadingHistory(historyData);
          resume.historyId = saved.id;
        } catch (err) {
          // Ambigu (jaringan lemot/putus) atau bentrok saat retry: bisa jadi baris
          // itu hasil request kita sendiri. Pakai ulang, jangan bikin dobel.
          const maybeOurs = isAmbiguous(err) || (retrying && err?.status === 409);
          const own = maybeOurs ? await adoptOwnHistory({ companyId, date, type, pic }, resume) : null;
          if (!own) throw err;
          resume.historyId = own.id;
        }
      }

      // 3b. Simpan foto — aman diulang (server melewati url yang sudah ada).
      const photoRecords = uploadedPhotos.map((photo, index) => ({
        history_id: resume.historyId,
        url: photo.url,
        filename: photo.name,
        size_bytes: photo.size,
        sort_order: index + 1
      }));

      let lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await addPhotos(photoRecords);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (!isAmbiguous(err)) break; // error pasti (4xx) -> jangan ulang
          await wait(1000 * attempt);
        }
      }
      if (lastErr) throw lastErr;

      if (crewIds.length > 0) {
        try {
          await setHistoryCrew(resume.historyId, crewIds);
        } catch (e) {
          console.warn('Gagal simpan tim:', e?.message);
        }
      }
    } catch (dbError) {
      // Hapus file S3 HANYA kalau history memang tidak terbentuk dan errornya pasti
      // (mis. duplikat 409/validasi). Kalau ambigu atau history sudah ada, file
      // dipertahankan agar "Coba lagi" bisa melanjutkan tanpa upload/insert ulang.
      if (!resume.historyId && !isAmbiguous(dbError)) {
        await Promise.all(
          (uploadedPhotos || []).map(async (p) => {
            try { await deleteFromS3(p.url); } catch { /* abaikan */ }
          })
        );
        resume.uploadedPhotos = null;
        resume.historyAttemptedAt = null;
      }
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

    return { historyId: resume.historyId, photoCount: files.length };
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
