import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/** Banner tetap di atas saat offline — user paham data mungkin basi. */
const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] bg-gray-900 text-white animate-fade-in">
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium">
        <WifiOff className="w-4 h-4 text-amber-400" />
        <span>Kamu offline — data yang tampil mungkin tidak terbaru</span>
      </div>
    </div>
  );
};

export default OfflineBanner;
