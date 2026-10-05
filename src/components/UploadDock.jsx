import React from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, X, RotateCcw } from 'lucide-react';
import { useUploadQueue } from '../context/UploadQueueContext';

const STATUS_TEXT = {
  queued: 'Antre...',
  compressing: 'Menyiapkan media...',
  uploading: 'Mengupload media...',
  saving: 'Menyimpan data...',
  success: 'Berhasil!',
  error: 'Gagal',
};

/**
 * Dock progress upload background — pojok kiri bawah (FAB di kanan).
 * Muncul hanya saat ada job aktif/riwayat.
 */
const UploadDock = () => {
  const { jobs, retryJob, dismissJob } = useUploadQueue();

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[calc(100%-6.5rem)] max-w-xs space-y-2">
      {jobs.map(job => (
        <div
          key={job.id}
          className="bg-gray-900 text-white rounded-2xl shadow-2xl p-3.5 animate-slide-up"
        >
          <div className="flex items-start gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              job.status === 'success' ? 'bg-green-500/20' :
              job.status === 'error' ? 'bg-red-500/20' : 'bg-white/10'
            }`}>
              {job.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : job.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : job.payload.type === 'perawatan' ? (
                <Upload className="w-5 h-5 text-blue-400" />
              ) : (
                <Upload className="w-5 h-5 text-garden" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{job.label}</p>
              <p className="text-[11px] text-white/60">
                {job.status === 'error' ? job.error : STATUS_TEXT[job.status] || job.status}
              </p>
              {(job.status === 'uploading' || job.status === 'compressing' || job.status === 'saving') && (
                <div className="mt-2 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-garden to-green-400 transition-all duration-300"
                    style={{ width: `${job.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
            {job.status === 'error' ? (
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => retryJob(job.id)}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Coba lagi"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => dismissJob(job.id)}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Hapus"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (job.status === 'success' || job.status === 'queued') && (
              <button
                onClick={() => dismissJob(job.id)}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
                title="Tutup"
              >
                {job.status === 'queued' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default UploadDock;
