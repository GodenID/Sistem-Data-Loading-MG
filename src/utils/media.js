export const MAX_VIDEO_DURATION_SECONDS = 60;

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];

export const getFileMediaType = (file) => {
  if (!file) return 'unknown';
  if (file.type?.startsWith('video/')) return 'video';
  if (file.type?.startsWith('image/')) return 'image';
  return getMediaTypeFromName(file.name);
};

export const getMediaTypeFromName = (name = '') => {
  const cleanName = name.split('?')[0].split('#')[0].toLowerCase();
  const ext = cleanName.includes('.') ? cleanName.split('.').pop() : '';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return 'unknown';
};

export const getMediaTypeFromUrl = (url = '', filename = '') => {
  return getMediaTypeFromName(filename) !== 'unknown'
    ? getMediaTypeFromName(filename)
    : getMediaTypeFromName(url);
};

export const getVideoDuration = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(resolve, video.duration || 0);
    video.onerror = () => finish(reject, new Error(`Gagal membaca durasi video: ${file.name}`));
    video.src = objectUrl;
  });
};

export const createMediaItemsFromFiles = async (files) => {
  const items = [];
  const errors = [];

  for (const file of files) {
    const mediaType = getFileMediaType(file);

    if (mediaType === 'unknown') {
      errors.push(`${file.name}: format file tidak didukung`);
      continue;
    }

    let duration = null;
    if (mediaType === 'video') {
      try {
        duration = await getVideoDuration(file);
      } catch (error) {
        errors.push(error.message);
        continue;
      }

      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        errors.push(`${file.name}: durasi ${Math.ceil(duration)} detik, maksimal ${MAX_VIDEO_DURATION_SECONDS} detik`);
        continue;
      }
    }

    items.push({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      mediaType,
      duration,
      size: (file.size / 1024 / 1024).toFixed(2),
      originalSize: file.size,
      compressedSize: mediaType === 'video' ? file.size : undefined,
      isCompressing: mediaType === 'image'
    });
  }

  return { items, errors };
};

export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const getMediaKindLabel = (items = []) => {
  const hasImage = items.some(item => item.mediaType === 'image' || getMediaTypeFromUrl(item.url, item.filename) === 'image');
  const hasVideo = items.some(item => item.mediaType === 'video' || getMediaTypeFromUrl(item.url, item.filename) === 'video');

  if (hasImage && hasVideo) return 'Foto dan video';
  if (hasVideo) return 'Video';
  return 'Foto';
};

export const getMediaUploadSuccessMessage = (items = []) => {
  return `${getMediaKindLabel(items)} berhasil di upload`;
};

export const getMediaExtension = (url = '', contentType = '') => {
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('quicktime')) return 'mov';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';

  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  const ext = cleanUrl.includes('.') ? cleanUrl.split('.').pop() : '';
  if ([...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'jpg';
};
