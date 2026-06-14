import React, { useEffect, useState } from 'react';
import { subscribeToasts, toast } from '../utils/toast';

const STYLES = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-gray-800',
};

const Toaster = () => {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`${STYLES[t.type] || STYLES.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3`}
        >
          <span className="flex-1 whitespace-pre-line text-sm leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Tutup notifikasi"
            className="text-white/80 hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
