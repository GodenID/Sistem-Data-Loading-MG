import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Leaf,
  Shield
} from 'lucide-react';
import { APP_VERSION } from '../utils/version';

const CORRECT_PASSWORD = import.meta.env.VITE_HOME_PASSWORD || '';

const HomePasswordModal = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const isAuth = sessionStorage.getItem('homeAuthenticated');
    if (isAuth === 'true') {
      onAuthenticated();
    }
  }, [onAuthenticated]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate checking delay
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        sessionStorage.setItem('homeAuthenticated', 'true');
        onAuthenticated();
      } else {
        setError('Password salah!');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-garden-light/30 via-white to-garden-light/20 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[800px] h-[800px] rounded-full bg-garden/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[600px] h-[600px] rounded-full bg-garden/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-garden to-garden-dark p-8 text-center">
            <div className="h-24 w-auto mx-auto mb-4 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-full w-auto object-contain drop-shadow-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Mutiari Garden</h1>
            <p className="text-white/80 text-sm">Report Dokumentasi System</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-garden" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Akses Dokumentasi</h2>
                <p className="text-xs text-gray-500">Masukkan password untuk melanjutkan</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className="
                      w-full pl-12 pr-12 py-4 rounded-xl
                      bg-gray-50 border-2 border-gray-200
                      text-gray-800 font-medium
                      placeholder:text-gray-400
                      focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10
                      transition-all duration-200
                    "
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
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
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium animate-fade-in">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!password || isLoading}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg
                  flex items-center justify-center gap-2
                  transition-all duration-300
                  ${password && !isLoading
                    ? 'bg-gradient-to-r from-garden to-garden-dark text-white shadow-lg shadow-garden/30 hover:shadow-xl hover:shadow-garden/40 hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400">
                © 2026 Mutiari Garden. Hak Cipta Dilindungi. • v{APP_VERSION}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePasswordModal;
