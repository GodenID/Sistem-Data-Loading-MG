import React from 'react';
import { ShieldAlert, X, Building2, Calendar, User, Image as ImageIcon } from 'lucide-react';

// Modal blokir duplikat mutlak: data loading/perawatan untuk
// perusahaan+tanggal+tipe yang sama sudah ada — tidak bisa tambah lagi.
const DuplicateBlockedModal = ({ isOpen, onClose, record, type = 'loading' }) => {
  if (!isOpen) return null;

  const isPerawatan = (record?.type || type) === 'perawatan';
  const fmtDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('id-ID', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Data Sudah Ada</h2>
            <p className="text-white/80 text-xs">
              {isPerawatan ? 'Perawatan' : 'Loading'} tidak dapat diduplikat
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            aria-label="Tutup"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Satu perusahaan hanya boleh punya <span className="font-semibold text-gray-900">1 {isPerawatan ? 'perawatan' : 'loading'} per tanggal</span>.
            Data berikut sudah tercatat — pengisian dibatalkan agar tidak ganda.
          </p>

          {record ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-2.5">
              {record.code && (
                <span className="inline-block px-2 py-0.5 rounded-md bg-gray-900 text-white text-[11px] font-mono font-semibold">
                  {record.code}
                </span>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-semibold text-gray-900 truncate">{record.companyName || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{fmtDate(record.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Diinput oleh: <span className="font-medium">{record.pic || '-'}</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{record.photo_count || 0} media terlampir</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Data bentrok ditemukan di database.
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Jika ini keliru (mis. salah tanggal), hubungi penginput di atas atau admin untuk koreksi data yang sudah ada.
          </p>

          <button
            onClick={onClose}
            className="mt-5 w-full py-3.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateBlockedModal;
