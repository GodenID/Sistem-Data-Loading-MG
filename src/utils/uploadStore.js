// Penyimpanan antrean upload di IndexedDB supaya tidak hilang saat tab
// di-reload / HP restart / koneksi putus. Semua fungsi AMAN: kalau IndexedDB
// tidak tersedia (mode privat, kuota penuh, browser lama) hasilnya diam-diam
// kosong dan upload tetap berjalan seperti biasa (hanya tanpa persistensi).
//
// Dua store terpisah supaya update progres (kecil) tidak menulis ulang file (besar):
//   jobs  : { id, key, label, payload (tanpa file), resume, createdAt }
//   files : { id, files: [ { file: Blob, name, mediaType, ... } ] }

const DB_NAME = 'mg-upload-queue';
const DB_VERSION = 1;

let dbPromise = null;

const openDb = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

// Jalankan satu transaksi; selalu resolve (null kalau gagal).
const run = async (stores, mode, fn) => {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(stores, mode);
      let result = null;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
      result = fn(tx);
    } catch {
      resolve(null);
    }
  });
};

const reqValue = (request) =>
  new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });

// Bagian file yang disimpan: buang field yang tidak bisa/tidak perlu disimpan (preview = blob: URL).
const toStoredFile = (f) => ({
  id: f.id,
  file: f.file,
  name: f.name,
  mediaType: f.mediaType,
  duration: f.duration ?? null,
  size: f.size,
  originalSize: f.originalSize,
  compressedSize: f.compressedSize,
  isCompressing: false,
  skipped: f.skipped,
  width: f.width,
  height: f.height,
});

const cloneJson = (v) => JSON.parse(JSON.stringify(v ?? {}));

export const saveJob = async (job) => {
  const { files, ...payload } = job.payload;
  const ok = await run(['jobs', 'files'], 'readwrite', (tx) => {
    tx.objectStore('jobs').put({
      id: job.id,
      key: job.key,
      label: job.label,
      payload: cloneJson(payload),
      resume: cloneJson(job.resume),
      createdAt: Date.now(),
    });
    tx.objectStore('files').put({ id: job.id, files: (files || []).map(toStoredFile) });
    return true;
  });
  return !!ok;
};

export const saveResume = async (id, resume) => {
  await run(['jobs'], 'readwrite', (tx) => {
    const store = tx.objectStore('jobs');
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, resume: cloneJson(resume) });
    };
    return true;
  });
};

// Foto sudah ada di S3 -> file lokal tidak diperlukan lagi, bebaskan penyimpanan.
export const dropFiles = async (id) => {
  await run(['files'], 'readwrite', (tx) => {
    tx.objectStore('files').delete(id);
    return true;
  });
};

export const deleteJob = async (id) => {
  await run(['jobs', 'files'], 'readwrite', (tx) => {
    tx.objectStore('jobs').delete(id);
    tx.objectStore('files').delete(id);
    return true;
  });
};

// Muat semua job tersimpan beserta file-nya (atau stub kalau file sudah dibuang
// karena upload ke S3 sudah selesai).
export const loadJobs = async () => {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(['jobs', 'files'], 'readonly');
    const jobs = (await reqValue(tx.objectStore('jobs').getAll())) || [];
    const out = [];
    for (const j of jobs) {
      const rec = await reqValue(tx.objectStore('files').get(j.id));
      let files = rec?.files;
      if (!files && j.resume?.uploadedPhotos) {
        files = j.resume.uploadedPhotos.map((p, i) => ({
          id: `stub-${i}`,
          file: { size: p.size || 0 },
          name: p.name,
          originalSize: p.size || 0,
          compressedSize: p.size || 0,
          isCompressing: false,
        }));
      }
      if (!files || !files.length) continue; // tidak ada yang bisa dilanjutkan
      out.push({ ...j, payload: { ...j.payload, files } });
    }
    return out;
  } catch {
    return [];
  }
};
