import React, { useState } from 'react';
import { 
  Database, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Calendar,
  HardDrive
} from 'lucide-react';
import { getCompanies, getLoadingHistory } from '../utils/supabase';
import { uploadToS3 } from '../utils/s3Config';

const BackupButton = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupProgress, setBackupProgress] = useState(0);

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      setBackupStatus({ type: 'loading', message: 'Mengambil data dari database...' });
      setBackupProgress(10);

      // 1. Fetch all data from database
      const [companies, history] = await Promise.all([
        getCompanies(),
        getLoadingHistory()
      ]);

      setBackupProgress(30);
      setBackupStatus({ type: 'loading', message: `Backup ${companies.length} perusahaan dan ${history.length} riwayat...` });

      // 2. Prepare backup data
      const backupData = {
        timestamp: new Date().toISOString(),
        metadata: {
          totalCompanies: companies.length,
          totalHistory: history.length,
          backupDate: new Date().toLocaleString('id-ID'),
          version: '1.0'
        },
        companies,
        history
      };

      // 3. Convert to JSON
      const jsonData = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const file = new File([blob], `backup-${new Date().toISOString().split('T')[0]}.json`, { type: 'application/json' });

      setBackupProgress(60);
      setBackupStatus({ type: 'loading', message: 'Upload ke S3 Onidel...' });

      // 4. Upload to S3
      const folder = `backups/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/`;
      const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      const uploadedUrl = await uploadToS3(file, folder, filename);

      setBackupProgress(100);
      setBackupStatus({ 
        type: 'success', 
        message: `Backup berhasil! ${companies.length} perusahaan, ${history.length} riwayat.`,
        url: uploadedUrl
      });

      // Clear status after 5 seconds
      setTimeout(() => {
        setBackupStatus(null);
        setBackupProgress(0);
      }, 5000);

    } catch (error) {
      console.error('Backup error:', error);
      setBackupStatus({ 
        type: 'error', 
        message: `Backup gagal: ${error.message}` 
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleBackup}
        disabled={isBackingUp}
        className={`
          w-full p-5 rounded-2xl border text-left transition-all duration-300
          ${isBackingUp 
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
            : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:shadow-lg hover:border-purple-300'
          }
        `}
      >
        <div className="flex items-start gap-4">
          <div className={`
            w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
            ${isBackingUp ? 'bg-gray-200' : 'bg-gradient-to-br from-purple-500 to-blue-500'}
          `}>
            {isBackingUp ? (
              <Loader2 className="w-7 h-7 text-gray-500 animate-spin" />
            ) : (
              <Database className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">
              {isBackingUp ? 'Sedang Backup...' : 'Backup ke Cloud'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {isBackingUp 
                ? 'Jangan tutup halaman ini' 
                : 'Simpan semua data ke Cloud'
              }
            </p>
            
            {/* Progress Bar */}
            {isBackingUp && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${backupProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{backupProgress}%</p>
              </div>
            )}
          </div>
          {!isBackingUp && <Upload className="w-5 h-5 text-purple-500" />}
        </div>
      </button>

      {/* Status Message */}
      {backupStatus && (
        <div className={`
          p-4 rounded-xl flex items-start gap-3 text-sm
          ${backupStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : ''}
          ${backupStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : ''}
          ${backupStatus.type === 'loading' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
        `}>
          {backupStatus.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {backupStatus.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {backupStatus.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{backupStatus.message}</p>
            {backupStatus.url && (
              <a 
                href={backupStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline mt-1 block hover:text-green-800"
              >
                Lihat file backup
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupButton;
