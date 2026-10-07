import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getMediaExtension, getMediaTypeFromUrl } from './media';
import { API_BASE } from './api';

// Download via backend (bypass CORS bucket S3). Gagal -> lempar agar
// pemanggil bisa coba metode langsung.
const downloadViaProxy = async (url, filename) => {
  if (!API_BASE) throw new Error('API belum dikonfigurasi');
  const proxy = `${API_BASE}/api/media/download?src=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || 'file')}`;
  const response = await fetch(proxy, { method: 'GET' });
  if (!response.ok) throw new Error('Proxy gagal');
  return response.blob();
};

/**
 * Download media using image fallback for CORS-sensitive images.
 * @param {string} url - URL media
 * @returns {Promise<Blob>}
 */
const downloadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Gagal mengkonversi gambar'));
        }
      }, 'image/jpeg', 0.95);
    };
    
    img.onerror = () => {
      // Fallback: try fetch with no-cors
      fetch(url, { mode: 'no-cors' })
        .then(() => {
          // If no-cors works, we can't read the response but we can try proxy approach
          reject(new Error('CORS blocked - menggunakan metode alternatif'));
        })
        .catch(reject);
    };
    
    img.src = url;
  });
};

/**
 * Download media sebagai file ZIP
 * @param {Array} photos - Array URL media
 * @param {string} companyName - Nama perusahaan
 * @param {string} date - Tanggal rotasi
 * @param {string} pic - Nama PIC
 */
export const downloadPhotosAsZip = async (photos, companyName, date, pic) => {
  if (!photos || photos.length === 0) {
    throw new Error('Tidak ada media untuk diunduh');
  }

  const zip = new JSZip();
  
  // Format nama folder: NamaPerusahaan_YYYY-MM-DD_PIC
  const formattedDate = date ? date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const safeCompanyName = (companyName || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const safePic = (pic || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const folderName = `${safeCompanyName}_${formattedDate}_${safePic}`;
  
  // Buat folder dalam ZIP
  const folder = zip.folder(folderName);
  
  // Track progress
  let successCount = 0;
  let failedCount = 0;
  
  // Download semua media dan tambahkan ke ZIP
  const downloadPromises = photos.map(async (photoUrl, index) => {
    try {
      let blob;
      const mediaType = getMediaTypeFromUrl(photoUrl);

      // Determine extension from blob type or URL
      const extension = getMediaExtension(photoUrl, '');
      const fileName = `${String(index + 1).padStart(3, '0')}.${extension}`;

      // Method 0 (utama): via backend proxy — bebas CORS
      try {
        blob = await downloadViaProxy(photoUrl, fileName);
      } catch (proxyError) {
        // Method 1: fetch langsung
        try {
          const response = await fetch(photoUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
          });

          if (response.ok) {
            blob = await response.blob();
          } else {
            throw new Error('Fetch failed');
          }
        } catch (fetchError) {
          if (mediaType === 'video') {
            throw fetchError;
          }

          // Method 2: XMLHttpRequest
          try {
            blob = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', photoUrl, true);
              xhr.responseType = 'blob';
              xhr.onload = () => {
                if (xhr.status === 200) {
                  resolve(xhr.response);
                } else {
                  reject(new Error('XHR failed'));
                }
              };
              xhr.onerror = () => reject(new Error('XHR error'));
              xhr.send();
            });
          } catch (xhrError) {
            // Method 3: canvas (gambar saja)
            blob = await downloadImage(photoUrl);
          }
        }
      }

      // Tambahkan ke folder
      folder.file(fileName, blob);
      
      successCount++;
      return { success: true, index };
    } catch (error) {
      console.error(`Error downloading photo ${index + 1}:`, error);
      failedCount++;
      return { success: false, index, error: error.message };
    }
  });
  
  // Tunggu semua download selesai
  await Promise.all(downloadPromises);
  
  if (successCount === 0) {
    throw new Error('Semua media gagal diunduh. Kemungkinan masalah CORS dari server S3.');
  }
  
  // Buat file ZIP
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6
    }
  });
  
  // Simpan file
  const zipFileName = `${folderName}.zip`;
  saveAs(zipBlob, zipFileName);
  
  return {
    success: true,
    total: photos.length,
    downloaded: successCount,
    failed: failedCount,
    fileName: zipFileName
  };
};

/**
 * Download single foto
 * @param {string} photoUrl - URL foto
 * @param {string} fileName - Nama file
 */
export const downloadSinglePhoto = async (photoUrl, fileName = 'foto.jpg') => {
  try {
    // Utama: via backend proxy (bebas CORS)
    try {
      const blob = await downloadViaProxy(photoUrl, fileName);
      saveAs(blob, fileName);
      return { success: true };
    } catch {
      /* lanjut ke metode langsung */
    }

    // Fallback: fetch langsung
    const response = await fetch(photoUrl, {
      method: 'GET',
      mode: 'cors',
    });

    if (response.ok) {
      const blob = await response.blob();
      saveAs(blob, fileName);
      return { success: true };
    }

    // Fallback terakhir: XHR
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', photoUrl, true);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(new Error('Failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Failed'));
      xhr.send();
    });

    saveAs(blob, fileName);
    return { success: true };
  } catch (error) {
    console.error('Error downloading photo:', error);
    throw error;
  }
};
