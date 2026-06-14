/**
 * Image Compression Utility
 * Compresses images before upload while maintaining quality
 */

/**
 * Compress an image file
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 1920)
 * @param {number} options.maxHeight - Maximum height (default: 1920)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.9)
 * @returns {Promise<{file: File, originalSize: number, compressedSize: number}>}
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.9
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Use better quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // Create new file from blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            resolve({
              file: compressedFile,
              originalSize: file.size,
              compressedSize: blob.size,
              width,
              height
            });
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress multiple images
 * @param {Array<{file: File, id: string, preview: string, name: string, size: string}>} photos 
 * @param {Function} onProgress - Callback for progress updates (compressed, total)
 * @param {Object} options - Compression options
 * @returns {Promise<Array<{file: File, id: string, preview: string, name: string, originalSize: number, compressedSize: number}>>}
 */
export const compressMultipleImages = async (photos, onProgress = null, options = {}) => {
  const results = [];
  const total = photos.length;
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    
    // Skip if already small enough (< 500KB)
    if (photo.file.size < 500 * 1024) {
      results.push({
        ...photo,
        file: photo.file,
        originalSize: photo.file.size,
        compressedSize: photo.file.size,
        skipped: true
      });
    } else {
      try {
        const compressed = await compressImage(photo.file, options);
        results.push({
          ...photo,
          file: compressed.file,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          width: compressed.width,
          height: compressed.height,
          skipped: false
        });
      } catch (error) {
        console.warn('Compression failed for', photo.name, '- using original');
        results.push({
          ...photo,
          file: photo.file,
          originalSize: photo.file.size,
          compressedSize: photo.file.size,
          skipped: true,
          error: true
        });
      }
    }
    
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }
  
  return results;
};

/**
 * Format file size for display
 * @param {number} bytes 
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate compression savings
 * @param {number} originalSize 
 * @param {number} compressedSize 
 * @returns {string}
 */
export const calculateSavings = (originalSize, compressedSize) => {
  const savings = originalSize - compressedSize;
  const percentage = ((savings / originalSize) * 100).toFixed(0);
  return `${percentage}%`;
};
