import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Users } from 'lucide-react';
import { getTeam } from '../utils/supabase';

// Pilih banyak user (tim) dengan search/autocomplete.
// Props: value=[{id,username,name}], onChange(next), placeholder
const CrewPicker = ({ value = [], onChange, placeholder = 'Cari nama tim...' }) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    // Default TERTUTUP: daftar nama hanya muncul saat mengetik pencarian.
    if (!query.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await getTeam(query.trim());
        const picked = new Set(value.map((v) => v.id));
        setOptions((list || []).filter((u) => !picked.has(u.id)).slice(0, 8));
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (u) => {
    onChange([...value, { id: u.id, username: u.username, name: u.name }]);
    setQuery('');
    setOptions([]);
    setOpen(false);
  };

  const remove = (id) => onChange(value.filter((v) => v.id !== id));

  return (
    <div ref={boxRef} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-garden/10 text-garden-dark text-sm font-medium"
            >
              {v.name || v.username}
              <button
                type="button"
                onClick={() => remove(v.id)}
                className="w-5 h-5 rounded-full bg-white flex items-center justify-center hover:bg-gray-200"
                aria-label={`Hapus ${v.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length ? 'Tambah lagi...' : placeholder}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 transition-all"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-3 text-sm text-gray-500">Mencari...</p>
          ) : options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" /> Tidak ketemu — pastikan sudah punya akun
            </p>
          ) : (
            options.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pick(u)}
                className="w-full text-left px-4 py-2.5 hover:bg-garden/5 flex items-center justify-between gap-2"
              >
                <span className="font-medium text-gray-800 text-sm truncate">{u.name || u.username}</span>
                <span className="text-xs text-gray-400 shrink-0">@{u.username} • {u.role}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CrewPicker;
