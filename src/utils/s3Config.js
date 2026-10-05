import AWS from 'aws-sdk';
import { getFileMediaType, getMediaExtension } from './media';

// Konfigurasi S3 Onidel Cloud
const S3_CONFIG = {
  endpoint: 'https://s3.ap-southeast-1.onidel.cloud',
  region: 'ap-southeast-1',
  bucket: 'loading', // Bucket ID
  forcePathStyle: true, // Diperlukan untuk S3-compatible services
  signatureVersion: 'v4',
};

const MAX_UPLOAD_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableUploadError = (error) => {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();

  return (
    error?.retryable === true ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('connection') ||
    message.includes('socket') ||
    message.includes('temporarily') ||
    message.includes('throttl') ||
    message.includes('slowdown') ||
    error?.statusCode >= 500
  );
};

// Inisialisasi S3 client dengan credentials dari environment variables
const getS3Client = () => {
  const accessKeyId = import.meta.env.VITE_S3_ACCESS_KEY;
  const secretAccessKey = import.meta.env.VITE_S3_SECRET_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('S3 credentials tidak ditemukan! Pastikan .env file sudah dikonfigurasi.');
    throw new Error('S3 credentials tidak tersedia');
  }
  
  return new AWS.S3({
    endpoint: S3_CONFIG.endpoint,
    region: S3_CONFIG.region,
    forcePathStyle: S3_CONFIG.forcePathStyle,
    signatureVersion: S3_CONFIG.signatureVersion,
    accessKeyId,
    secretAccessKey,
  });
};

/**
 * Upload file ke S3 Onidel
 * @param {File} file - File yang akan diupload
 * @param {string} folder - Folder path (contoh: '2026/02/15/')
 * @param {string} filename - Nama file
 * @returns {Promise<string>} URL file
 */
export const uploadToS3 = async (file, folder = '', filename = null) => {
  const s3 = getS3Client();
  const safeFilename = filename || `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const key = folder ? `${folder}${safeFilename}` : safeFilename;

  const params = {
    Bucket: S3_CONFIG.bucket,
    Key: key,
    Body: file,
    ContentType: file.type,
    ACL: 'public-read', // File bisa diakses public
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      await s3.putObject(params).promise();

      return `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
    } catch (error) {
      lastError = error;
      console.warn(`Upload attempt ${attempt}/${MAX_UPLOAD_RETRIES} failed for ${safeFilename}:`, error);

      if (attempt === MAX_UPLOAD_RETRIES || !isRetryableUploadError(error)) {
        break;
      }

      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  console.error('Error uploading to S3:', lastError);
  throw new Error(`Gagal upload ke S3 setelah ${MAX_UPLOAD_RETRIES} percobaan: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Upload multiple files ke S3
 * @param {Array} files - Array file objects {file, id}
 * @param {string} companyName - Nama perusahaan untuk folder
 * @param {string} date - Tanggal untuk folder
 * @param {string} type - 'loading' atau 'perawatan'
 * @returns {Promise<Array>} Array URL file
 */
export const uploadMultipleToS3 = async (files, companyName, date, type = 'loading') => {
  try {
    // Buat folder path yang rapih: loading/2026/02/15/nama-perusahaan/
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    // Clean company name untuk folder
    const safeCompanyName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const folder = `${type}/${year}/${month}/${day}/${safeCompanyName}/`;

    const uploadPromises = files.map(async (fileObj, index) => {
      // Format nama file: 001.jpg, 002.mp4, dst
      const extension = getMediaExtension(fileObj.file.name, fileObj.file.type);
      const filename = `${String(index + 1).padStart(3, '0')}.${extension}`;
      
      const url = await uploadToS3(fileObj.file, folder, filename);
      
      return {
        id: fileObj.id,
        url: url,
        name: filename,
        size: fileObj.file.size,
        mediaType: fileObj.mediaType || getFileMediaType(fileObj.file)
      };
    });

    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw error;
  }
};

/**
 * Delete file dari S3
 * @param {string} fileUrlOrKey - URL file atau key yang akan dihapus
 */
export const deleteFromS3 = async (fileUrlOrKey) => {
  try {
    const s3 = getS3Client();

    // Determine if it's a URL or a key
    let key = fileUrlOrKey;
    if (fileUrlOrKey.startsWith('http')) {
      // Extract key dari URL: https://endpoint/bucket/key -> key
      const url = new URL(fileUrlOrKey);
      key = decodeURIComponent(url.pathname.substring(1)); // Remove leading slash
      // URL mengandung prefix bucket (endpoint/bucket/key), sedangkan
      // deleteObject butuh Key tanpa nama bucket -> strip prefix bucket/
      const bucketPrefix = `${S3_CONFIG.bucket}/`;
      if (key.startsWith(bucketPrefix)) {
        key = key.slice(bucketPrefix.length);
      }
    } else {
      key = decodeURIComponent(key);
      const bucketPrefix = `${S3_CONFIG.bucket}/`;
      if (key.startsWith(bucketPrefix)) {
        key = key.slice(bucketPrefix.length);
      }
    }

    if (!key) throw new Error('Key file kosong');

    const params = {
      Bucket: S3_CONFIG.bucket,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    return { success: true };
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error(`Gagal hapus file: ${error.message}`);
  }
};

/**
 * Hapus banyak file dari S3. Gagal per-file tidak menggagalkan keseluruhan,
 * hasilnya dilaporkan per file agar pemanggil bisa lanjut hapus DB.
 * @param {string[]} urlsOrKeys
 * @returns {Promise<{deleted: number, failed: number}>}
 */
export const deleteMultipleFromS3 = async (urlsOrKeys = []) => {
  let deleted = 0;
  let failed = 0;
  await Promise.all(
    urlsOrKeys.map(async (u) => {
      try {
        await deleteFromS3(u);
        deleted += 1;
      } catch (e) {
        console.warn('Gagal hapus file S3:', u, e?.message);
        failed += 1;
      }
    })
  );
  return { deleted, failed };
};

/**
 * Generate folder path untuk upload
 * @param {string} type - 'loading' atau 'perawatan'
 * @param {string} companyName - Nama perusahaan
 * @param {string} date - Tanggal (YYYY-MM-DD)
 * @returns {string} Folder path
 */
export const generateFolderPath = (type, companyName, date) => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  const safeCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${type}/${year}/${month}/${day}/${safeCompanyName}/`;
};

export default S3_CONFIG;
