import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileJson,
  Calendar,
  HardDrive,
  ArrowUpFromLine
} from 'lucide-react';
import { addCompany, addLoadingHistory, addPhotos } from '../utils/supabase';

const RestoreBackup = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
      setSelectedFile(file);
      setRestoreStatus(null);
    } else {
      setRestoreStatus({
        type: 'error',
        message: 'Silakan pilih file JSON yang valid'
      });
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      setRestoreStatus({
        type: 'error',
        message: 'Silakan pilih file backup terlebih dahulu'
      });
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreStatus({ type: 'loading', message: 'Membaca file backup...' });
      setRestoreProgress(10);

      // Read file
      const fileContent = await selectedFile.text();
      const backupData = JSON.parse(fileContent);

      setRestoreProgress(20);
      setRestoreStatus({ type: 'loading', message: `Restore ${backupData.metadata?.totalCompanies || 0} perusahaan...` });

      // Create company ID mapping (old ID -> new ID)
      const companyIdMap = {};
      
      // Restore companies
      if (backupData.companies && backupData.companies.length > 0) {
        for (let i = 0; i < backupData.companies.length; i++) {
          const company = backupData.companies[i];
          const oldId = company.id;
          
          // Remove ID to let database generate new one
          const { id, created_at, updated_at, ...companyData } = company;
          
          try {
            const newCompany = await addCompany(companyData);
            companyIdMap[oldId] = newCompany.id;
          } catch (error) {
            console.warn('Failed to restore company:', company.name, error);
          }
          
          setRestoreProgress(20 + Math.round(((i + 1) / backupData.companies.length) * 30));
        }
      }

      setRestoreProgress(50);
      setRestoreStatus({ type: 'loading', message: `Restore ${backupData.metadata?.totalHistory || 0} riwayat...` });

      // Restore loading history
      if (backupData.history && backupData.history.length > 0) {
        for (let i = 0; i < backupData.history.length; i++) {
          const history = backupData.history[i];
          
          // Map old company ID to new company ID
          const newCompanyId = companyIdMap[history.company_id];
          if (!newCompanyId) {
            console.warn('Skipping history - company not found:', history.company_id);
            continue;
          }
          
          const { id, created_at, updated_at, companyName, companies_reports, ...historyData } = history;
          
          try {
            await addLoadingHistory({
              ...historyData,
              company_id: newCompanyId
            });
          } catch (error) {
            console.warn('Failed to restore history:', error);
          }
          
          setRestoreProgress(50 + Math.round(((i + 1) / backupData.history.length) * 40));
        }
      }

      setRestoreProgress(100);
      setRestoreStatus({ 
        type: 'success', 
        message: 'Restore berhasil! Data telah dipulihkan ke database.'
      });

      // Clear file after success
      setSelectedFile(null);
      
      setTimeout(() => {
        setRestoreStatus(null);
        setRestoreProgress(0);
      }, 5000);

    } catch (error) {
      console.error('Restore error:', error);
      setRestoreStatus({ 
        type: 'error', 
        message: `Restore gagal: ${error.message}` 
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="w-full p-5 rounded-2xl border bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
            <ArrowUpFromLine className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">Restore dari Backup</h3>
            <p className="text-sm text-gray-500 mt-1">
              Pulihkan data dari file backup JSON
            </p>
            
            {/* File Input */}
            <div className="mt-4">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                disabled={isRestoring}
                className="hidden"
                id="restore-file"
              />
              <label
                htmlFor="restore-file"
                className={`
                  flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer
                  ${selectedFile 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-amber-300 hover:border-amber-400 bg-white'
                  }
                  ${isRestoring ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <FileJson className={`w-6 h-6 ${selectedFile ? 'text-green-600' : 'text-amber-500'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${selectedFile ? 'text-green-700' : 'text-gray-700'}`}>
                    {selectedFile ? selectedFile.name : 'Pilih file backup JSON'}
                  </p>
                  {selectedFile && (
                    <p className="text-xs text-green-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </label>
            </div>

            {/* Restore Button */}
            {selectedFile && (
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className={`
                  mt-3 w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2
                  transition-all duration-200
                  ${isRestoring
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-orange-500/30'
                  }
                `}
              >
                {isRestoring ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>Memulihkan...</span></>
                ) : (
                  <><ArrowUpFromLine className="w-5 h-5" /><span>Mulai Restore</span></>
                )}
              </button>
            )}

            {/* Progress Bar */}
            {isRestoring && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${restoreProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-gray-700 mt-2">
                  {restoreProgress}%
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {restoreStatus && (
        <div className={`
          p-4 rounded-xl flex items-start gap-3 text-sm
          ${restoreStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : ''}
          ${restoreStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : ''}
          ${restoreStatus.type === 'loading' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
        `}>
          {restoreStatus.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {restoreStatus.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          {restoreStatus.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p>{restoreStatus.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestoreBackup;
