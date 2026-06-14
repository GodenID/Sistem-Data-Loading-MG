import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getMediaExtension, getMediaTypeFromUrl } from './media';

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
      
      // Try multiple methods to download the image
      try {
        // Method 1: Try fetch first
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

        // Method 2: Try using XMLHttpRequest for better CORS handling
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
          // Method 3: Try image canvas approach
          blob = await downloadImage(photoUrl);
        }
      }
      
      // Determine extension from blob type or URL
      const extension = getMediaExtension(photoUrl, blob.type);
      
      // Nama file: 001.jpg, 002.mp4, dst
      const fileName = `${String(index + 1).padStart(3, '0')}.${extension}`;
      
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
    // Try fetch first
    const response = await fetch(photoUrl, {
      method: 'GET',
      mode: 'cors',
    });
    
    if (response.ok) {
      const blob = await response.blob();
      saveAs(blob, fileName);
      return { success: true };
    }
    
    // Fallback to XHR
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
