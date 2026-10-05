import React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';

/** Indikator tarik-untuk-refresh (bulat melayang di atas). */
const PullIndicator = ({ pull, refreshing }) => {
  if (pull <= 0 && !refreshing) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[85] sm:hidden">
      <div
        className="w-10 h-10 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center transition-transform"
        style={refreshing ? undefined : { transform: `scale(${Math.min(1, 0.5 + pull / 140)}) rotate(${pull * 2}deg)` }}
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 text-garden animate-spin" />
        ) : (
          <RotateCcw className="w-5 h-5 text-garden" />
        )}
      </div>
    </div>
  );
};

export default PullIndicator;
