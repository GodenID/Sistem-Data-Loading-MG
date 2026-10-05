import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { APP_VERSION } from '../utils/version';

// Foto panel kiri: fallback hijau daun kalau offline/gagal muat.
const PHOTO_URL =
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&auto=format&fit=crop';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const { login, isAdmin, user } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const goAfterLogin = (role) => {
    // Semua orang mendarat di halaman utama dulu.
    // Admin yang tadinya mau ke panel (from) dikembalikan ke sana,
    // selebihnya admin pun mulai dari halaman utama (ada tombol Admin Panel).
    if (role === 'admin' && typeof from === 'string' && from.startsWith('/admin')) {
      navigate(from, { replace: true });
    } else if (role !== 'admin' && typeof from === 'string' && !from.startsWith('/admin')) {
      navigate(from, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // Redirect jika sudah login
  if (isAdmin || user) {
    goAfterLogin(user?.role);
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username.trim(), password);
    if (result.success) {
      goAfterLogin(result.user.role);
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  };

  const canSubmit = username.trim() && password && !isLoading;

  return (
    <div className="min-h-screen bg-[#F4F1E8] text-[#1E2B23] flex flex-col lg:flex-row">
      {/* Kolom foto — strip atas di HP, panel kiri di desktop */}
      <div className="relative h-52 sm:h-64 lg:h-auto lg:min-h-screen lg:w-[46%] shrink-0 overflow-hidden bg-[#1E4D2B]">
        {photoOk && (
          <img
            src={PHOTO_URL}
            alt="Kebun Mutiari Garden"
            onError={() => setPhotoOk(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Cap tanggal ala label lapangan */}
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
          <div className="bg-[#F4F1E8] px-3 py-2 rounded shadow-lg">
            <p className="font-serif font-bold text-lg leading-none">Mutiari Garden</p>
            <p className="text-[11px] tracking-[0.18em] text-[#5B665E] mt-1">
              SISTEM DATA LOADING — LAPANGAN
            </p>
          </div>
        </div>
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-black/55 text-white text-[11px] tracking-[0.18em] px-2.5 py-1.5 rounded">
          V{APP_VERSION}
        </div>
      </div>

      {/* Kolom form */}
      <div className="flex-1 flex flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-0 lg:justify-center">
        <div className="w-full max-w-sm mx-auto lg:mx-0">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Mutiari Garden" className="h-11 w-auto object-contain" />
            <div className="border-l-2 border-[#1E2B23] pl-3">
              <p className="text-[11px] font-bold tracking-[0.22em]">MUTIARI GARDEN</p>
              <p className="text-[11px] tracking-[0.22em] text-[#5B665E]">DATA LOADING</p>
            </div>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl font-bold mt-8 leading-[1.05]">
            Masuk
            <br />
            kerja.
          </h1>
          <p className="text-sm text-[#5B665E] mt-3">
            Catat loading &amp; perawatan hari ini. Satu akun untuk satu orang.
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label className="block text-[11px] font-bold tracking-[0.18em] text-[#5B665E]">
              USERNAME
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mis. goden"
              autoComplete="username"
              autoFocus
              className="w-full bg-transparent border-b-2 border-[#1E2B23]/25 focus:border-[#1E4D2B] focus:outline-none py-2.5 text-lg font-medium placeholder:text-[#1E2B23]/30 placeholder:font-normal"
            />

            <label className="block text-[11px] font-bold tracking-[0.18em] text-[#5B665E] mt-6">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-transparent border-b-2 border-[#1E2B23]/25 focus:border-[#1E4D2B] focus:outline-none py-2.5 pr-10 text-lg font-medium placeholder:text-[#1E2B23]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute inset-y-0 right-0 flex items-center text-[#5B665E] hover:text-[#1E2B23]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="mt-5 border-l-4 border-[#B3261E] bg-[#B3261E]/5 px-3 py-2.5 text-sm font-medium text-[#B3261E]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`mt-8 w-full flex items-center justify-between px-5 py-4 rounded-lg font-bold text-white transition-colors ${
                canSubmit ? 'bg-[#1E4D2B] hover:bg-[#163B21] active:bg-[#122E1A]' : 'bg-[#1E2B23]/25 cursor-not-allowed'
              }`}
            >
              <span>{isLoading ? 'Membuka...' : 'Masuk'}</span>
              {isLoading ? (
                <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </form>

          <p className="text-xs text-[#5B665E] mt-8">
            © 2026 Mutiari Garden — V{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
