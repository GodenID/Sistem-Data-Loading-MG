import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock, Eye, EyeOff, User, LogIn, Camera, Globe, BarChart3, Leaf,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { APP_VERSION } from '../utils/version';

const FEATURES = [
  { icon: Camera, title: 'Dokumentasi Lapangan', desc: 'Foto loading & perawatan langsung dari HP' },
  { icon: Globe, title: 'Portal Klien', desc: 'Bagikan progres ke klien via link' },
  { icon: BarChart3, title: 'Rekap Otomatis', desc: 'Analitik & riwayat tersimpan rapi' },
];

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Panel branding — penuh di desktop, ringkas di HP */}
      <div className="relative overflow-hidden bg-gradient-to-br from-garden-dark via-garden to-emerald-600 text-white px-6 py-8 sm:p-10 lg:p-12 lg:w-[45%] lg:min-h-screen flex flex-col justify-center">
        {/* Dekorasi lingkaran */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-black/10" />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1.5 shadow-lg shrink-0">
            <img src="/logo.png" alt="Mutiari Garden" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Mutiari Garden</h1>
            <p className="text-white/80 text-xs sm:text-sm">Sistem Data Loading</p>
          </div>
          <span className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
            V{APP_VERSION}
          </span>
        </div>

        <div className="relative mt-6 lg:mt-10 space-y-4 hidden sm:block">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm sm:text-base">{f.title}</p>
                <p className="text-white/75 text-xs sm:text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative mt-6 lg:mt-10 text-white/60 text-xs hidden lg:flex items-center gap-1.5">
          <Leaf className="w-3.5 h-3.5" />
          © 2026 Mutiari Garden. Hak Cipta Dilindungi.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:p-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">Selamat datang 👋</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Masuk untuk mencatat dokumentasi lapangan
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username kamu..."
                    autoComplete="username"
                    autoFocus
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password..."
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium animate-fade-in">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!username.trim() || !password || isLoading}
                className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                  username.trim() && password && !isLoading
                    ? 'bg-gradient-to-r from-garden to-garden-dark text-white shadow-lg shadow-garden/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-400 text-xs mt-5">
            © 2026 Mutiari Garden • V{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
