import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { toast } from '../utils/toast';
import { processUpload } from '../utils/processUpload';
import { deleteFromS3 } from '../utils/s3Config';
import { saveJob, saveResume, dropFiles, deleteJob, loadJobs } from '../utils/uploadStore';

const UploadQueueContext = createContext(null);

const newJobId = () => `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const revokePreviews = (files = []) => {
  files.forEach(f => {
    try {
      if (f?.preview && String(f.preview).startsWith('blob:')) {
        URL.revokeObjectURL(f.preview);
      }
    } catch { /* abaikan */ }
  });
};

// Hanya satu tab yang boleh memproses satu job (cegah dobel kalau app dibuka di 2 tab).
// Kunci otomatis lepas kalau tab ditutup.
const withJobLock = (id, fn) => {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn();
  return navigator.locks.request(`mg-upload-${id}`, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('Sedang diproses di tab/jendela lain');
    return fn();
  });
};

/**
 * Antrean upload background (FIFO, satu per satu — hemat bandwidth HP).
 * Tetap jalan saat pindah halaman. Job disimpan di IndexedDB: kalau tab
 * di-reload / HP mati / koneksi putus, job muncul lagi di dock dengan status
 * "Gagal" dan bisa dilanjutkan lewat tombol coba lagi (melanjutkan dari tahap
 * terakhir yang berhasil, bukan mengulang dari nol).
 * Komponen cukup panggil enqueueUpload(payload) lalu tutup modal.
 */
export const UploadQueueProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef([]);
  const processingRef = useRef(false);

  const setJobsBoth = (updater) => {
    jobsRef.current = typeof updater === 'function' ? updater(jobsRef.current) : updater;
    setJobs(jobsRef.current);
  };

  const updateJob = (id, patch) => {
    setJobsBoth(prev => prev.map(j => (j.id === id ? { ...j, ...patch } : j)));
  };

  // Simpan perubahan state resume job (id history, foto yang sudah di S3, dst)
  const handleResumeChange = (job) => (resume) => {
    saveResume(job.id, resume);
    if (resume.uploadedPhotos && !job.filesDropped) {
      job.filesDropped = true; // file lokal tidak diperlukan lagi -> hemat penyimpanan
      dropFiles(job.id);
    }
  };

  const runJob = async (job) => {
    updateJob(job.id, { status: 'uploading', progress: 0, error: null });
    try {
      await withJobLock(job.id, () => processUpload(
        job.payload,
        (status, progress) => updateJob(job.id, { status, progress }),
        job.resume, // state yang bertahan antar retry (foto sudah ke S3, history sudah dibuat)
        handleResumeChange(job)
      ));
      revokePreviews(job.payload.files);
      deleteJob(job.id);
      updateJob(job.id, { status: 'success', progress: 100 });
      toast.success(
        `${job.label} berhasil diupload (${job.payload.files.length} media)`
      );
      // Halaman yang menampilkan data ini refresh sendiri (mis. ClientDetail, Home)
      window.dispatchEvent(new CustomEvent('mg-upload-done', {
        detail: { companyId: job.payload.companyId }
      }));
      // Sukses: hilang otomatis setelah 5 detik
      setTimeout(() => {
        setJobsBoth(prev => prev.filter(j => j.id !== job.id));
      }, 5000);
    } catch (e) {
      updateJob(job.id, { status: 'error', error: e?.message || 'Upload gagal' });
      toast.error(`Upload gagal (${job.label}): ${e?.message || 'coba lagi via dock bawah'}`);
    }
  };

  const pump = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      for (;;) {
        const next = jobsRef.current.find(j => j.status === 'queued');
        if (!next) break;
        await runJob(next);
      }
    } finally {
      processingRef.current = false;
    }
  };

  const enqueueUpload = (payload) => {
    // Anti dobel: satu perusahaan+tanggal+tipe hanya boleh punya 1 job di antrean
    // (termasuk yang error/menunggu retry). Menangkap double-tap & submit ulang.
    const key = `${payload.companyId}|${payload.date}|${payload.type}`;
    if (jobsRef.current.some(j => j.key === key)) {
      toast.error('Dokumentasi ini sudah ada di antrean upload. Cek dock di kiri bawah.');
      return null;
    }
    const id = newJobId();
    const label = `${payload.companyName} • ${payload.type === 'perawatan' ? 'Perawatan' : 'Loading'}`;
    const job = { id, key, payload, label, resume: {}, status: 'queued', progress: 0, error: null };
    setJobsBoth(prev => [...prev, job]);
    saveJob(job); // persisten (best-effort, tidak menahan upload)
    pump();
    return id;
  };

  const retryJob = (id) => {
    // Hanya job yang error yang boleh di-retry; cegah double-tap saat sedang jalan.
    const job = jobsRef.current.find(j => j.id === id);
    if (!job || job.status !== 'error') return;
    setJobsBoth(prev => prev.map(j =>
      j.id === id ? { ...j, status: 'queued', progress: 0, error: null } : j
    ));
    pump();
  };

  const dismissJob = (id) => {
    const job = jobsRef.current.find(j => j.id === id);
    if (job && job.status !== 'uploading' && job.status !== 'saving' && job.status !== 'compressing') {
      revokePreviews(job.payload.files);
      // Dibatalkan sebelum history terbentuk -> file yang sudah terupload jadi yatim; bersihkan.
      // (Tanpa historyId tidak mungkin ada baris foto yang menunjuk file ini.)
      if (job.status === 'error' && !job.resume?.historyId && job.resume?.uploadedPhotos?.length) {
        job.resume.uploadedPhotos.forEach(p => { deleteFromS3(p.url).catch(() => {}); });
      }
      deleteJob(id);
    }
    setJobsBoth(prev => prev.filter(j => j.id !== id));
  };

  // Pulihkan job yang tersisa dari sesi sebelumnya (tab di-reload / HP restart).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadJobs();
      if (cancelled || !stored.length) return;

      // Job yang sedang dikerjakan tab lain jangan ikut dimunculkan di sini.
      let heldByOthers = new Set();
      try {
        const q = await navigator.locks?.query?.();
        heldByOthers = new Set((q?.held || []).map(l => l.name));
      } catch { /* abaikan */ }

      const restored = stored
        .filter(s => !heldByOthers.has(`mg-upload-${s.id}`))
        .map(s => ({
          id: s.id,
          key: s.key,
          label: s.label,
          payload: s.payload,
          resume: s.resume || {},
          filesDropped: !!s.resume?.uploadedPhotos,
          status: 'error',
          progress: 0,
          error: 'Terputus saat halaman ditutup. Tekan coba lagi untuk melanjutkan.',
        }));
      if (!restored.length) return;

      setJobsBoth(prev => {
        const have = new Set(prev.map(j => j.key));
        return [...prev, ...restored.filter(r => !have.has(r.key))];
      });
      toast.info(`${restored.length} upload tertunda ditemukan — lanjutkan lewat dock di kiri bawah`);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UploadQueueContext.Provider value={{ jobs, enqueueUpload, retryJob, dismissJob }}>
      {children}
    </UploadQueueContext.Provider>
  );
};

export const useUploadQueue = () => {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error('useUploadQueue must be used within UploadQueueProvider');
  return ctx;
};
