import React, { createContext, useContext, useRef, useState } from 'react';
import { toast } from '../utils/toast';
import { processUpload } from '../utils/processUpload';

const UploadQueueContext = createContext(null);

let jobSeq = 0;

const revokePreviews = (files = []) => {
  files.forEach(f => {
    try {
      if (f?.preview && String(f.preview).startsWith('blob:')) {
        URL.revokeObjectURL(f.preview);
      }
    } catch { /* abaikan */ }
  });
};

/**
 * Antrean upload background (FIFO, satu per satu — hemat bandwidth HP).
 * Tetap jalan saat pindah halaman; hilang hanya jika tab di-reload.
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

  const runJob = async (job) => {
    updateJob(job.id, { status: 'uploading', progress: 0, error: null });
    try {
      await processUpload(
        job.payload,
        (status, progress) => updateJob(job.id, { status, progress }),
        job.resume // state yang bertahan antar retry (foto sudah ke S3, history sudah dibuat)
      );
      revokePreviews(job.payload.files);
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
    const id = ++jobSeq;
    const label = `${payload.companyName} • ${payload.type === 'perawatan' ? 'Perawatan' : 'Loading'}`;
    setJobsBoth(prev => [
      ...prev,
      { id, key, payload, label, resume: {}, status: 'queued', progress: 0, error: null }
    ]);
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
    if (job && job.status !== 'uploading' && job.status !== 'saving') {
      revokePreviews(job.payload.files);
    }
    setJobsBoth(prev => prev.filter(j => j.id !== id));
  };

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
