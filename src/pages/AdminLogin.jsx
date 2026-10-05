import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, Shield, User } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { APP_VERSION } from '../utils/version';

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
    if (role === 'admin') {
      navigate(typeof from === 'string' && from.startsWith('/admin') ? from : '/admin', { replace: true });
    } else {
      navigate(typeof from === 'string' && !from.startsWith('/admin') ? from : '/', { replace: true });
    }
  };

  // Redirect jika sudah login
  if (isAdmin) {
    navigate('/admin', { replace: true });
    return null;
  }
  if (user) {
    navigate('/', { replace: true });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm">Kembali</span>
      </button>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-garden to-garden-dark p-8 text-center">
            <div className="h-32 w-auto mx-auto mb-4 p-2 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-full w-auto object-contain drop-shadow-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Masuk</h1>
            <p className="text-white/80 text-sm">Mutiari Garden Report</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    placeholder="Username..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 transition-all duration-200"
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    placeholder="Masukkan password..."
                    className="w-full pl-12 pr-12 py-4 rounded-xl bg-gray-50 border-2 border-gray-200 text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-garden focus:ring-4 focus:ring-garden/10 transition-all duration-200"
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
                disabled={!username.trim() || !password || isLoading}
                className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                  username.trim() && password && !isLoading
                    ? 'bg-gradient-to-r from-garden to-garden-dark text-white shadow-lg shadow-garden/30 hover:shadow-xl hover:shadow-garden/40 hover:-translate-y-0.5 active:translate-y-0'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>


          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2026 Mutiari Garden. Hak Cipta Dilindungi. • v{APP_VERSION}
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
