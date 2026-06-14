import { uploadToS3, deleteFromS3 } from './s3Config';

// Dynamic import untuk background removal (heavy library)
let removeBackground;

export const loadBackgroundRemoval = async () => {
  if (!removeBackground) {
    const module = await import('@imgly/background-removal');
    removeBackground = module.default;
  }
  return removeBackground;
};

/**
 * Remove background dari image
 * @param {File} file - Image file
 * @returns {Promise<Blob>} - Image blob dengan background removed
 */
export const removeImageBackground = async (file) => {
  try {
    const removeBg = await loadBackgroundRemoval();
    
    // Convert file to blob
    const blob = await removeBg(file, {
      progress: (key, current, total) => {
        console.log(`Removing background: ${key} ${current}/${total}`);
      },
      output: {
        format: 'image/png',
        quality: 0.9
      }
    });
    
    return blob;
  } catch (error) {
    console.error('Error removing background:', error);
    throw new Error('Gagal menghapus background: ' + error.message);
  }
};

/**
 * Compress image before processing
 * @param {File} file - Image file
 * @param {number} maxWidth - Max width
 * @returns {Promise<File>}
 */
export const compressImage = async (file, maxWidth = 800) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale down if too large
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Gagal mengompres gambar'));
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal memuat gambar'));
    };
    img.src = objectUrl;
  });
};

/**
 * Upload logo perusahaan dengan background removal
 * @param {File} file - Logo file
 * @param {string} companyName - Nama perusahaan
 * @param {boolean} removeBg - Apakah hapus background
 * @returns {Promise<string>} - URL logo
 */
export const uploadCompanyLogo = async (file, companyName, removeBg = true) => {
  try {
    let processedFile = file;
    
    // Compress dulu untuk mempercepat processing
    if (file.size > 500 * 1024) { // > 500KB
      processedFile = await compressImage(file, 600);
    }
    
    // Remove background jika diminta
    if (removeBg) {
      try {
        const blob = await removeImageBackground(processedFile);
        processedFile = new File([blob], 'logo.png', { type: 'image/png' });
      } catch (bgError) {
        console.warn('Background removal failed, using original:', bgError);
        // Fallback ke original file
      }
    }
    
    // Upload ke S3
    const timestamp = Date.now();
    const sanitizedName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 30);
    const folder = 'logos/';
    const filename = `${sanitizedName}-${timestamp}.png`;
    
    const result = await uploadToS3(processedFile, folder, filename);
    return result;
  } catch (error) {
    console.error('Error uploading logo:', error);
    throw error;
  }
};

/**
 * Extract key from S3 URL
 * @param {string} url 
 * @returns {string|null}
 */
export const extractKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
};

/**
 * Delete logo lama dari S3
 * @param {string} logoUrl 
 */
export const deleteOldLogo = async (logoUrl) => {
  if (!logoUrl) return;
  
  try {
    await deleteFromS3(logoUrl);
    console.log('Old logo deleted:', logoUrl);
  } catch (error) {
    console.warn('Failed to delete old logo:', error);
  }
};
