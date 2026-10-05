import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { apiPost } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import PasswordStrength, { scorePassword } from '../components/PasswordStrength';
import { APP_VERSION } from '../utils/version';

// Halaman wajib ganti password (login pertama / habis di-reset admin).
// Password lama tidak ditanya — sesi login ini buktinya.
const ChangePassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const strongEnough = password.length >= 8 && scorePassword(password) >= 2;
  const match = password && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!strongEnough) {
      setError('Password minimal 8 karakter dan minimal level Sedang');
      return;
    }
    if (!match) {
      setError('Konfirmasi password tidak sama');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/auth/change-password', { newPassword: password });
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1E8] text-[#1E2B23] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.png" alt="Mutiari Garden" className="h-11 w-auto object-contain" />
          <div className="border-l-2 border-[#1E2B23] pl-3">
            <p className="text-[11px] font-bold tracking-[0.22em]">MUTIARI GARDEN</p>
            <p className="text-[11px] tracking-[0.22em] text-[#5B665E]">DATA LOADING</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="font-serif text-2xl font-bold">Buat password baru</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Login pertama wajib ganti password. Pilih yang kuat dan jangan bagikan ke siapa pun.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-[0.18em] text-[#5B665E]">
                PASSWORD BARU
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 karakter"
                  autoFocus
                  autoComplete="new-password"
                  className="w-full bg-transparent border-b-2 border-[#1E2B23]/25 focus:border-[#1E4D2B] focus:outline-none py-2.5 pl-12 pr-10 text-lg font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute inset-y-0 right-0 flex items-center text-[#5B665E]"
                >
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-[0.18em] text-[#5B665E]">
                ULANGI PASSWORD
              </label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Sama seperti di atas"
                autoComplete="new-password"
                className="w-full bg-transparent border-b-2 border-[#1E2B23]/25 focus:border-[#1E4D2B] focus:outline-none py-2.5 text-lg font-medium"
              />
              {confirm && !match && (
                <p className="text-xs text-red-600 font-medium mt-1">Belum sama</p>
              )}
              {match && (
                <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sama
                </p>
              )}
            </div>

            {error && (
              <p className="border-l-4 border-[#B3261E] bg-[#B3261E]/5 px-3 py-2.5 text-sm font-medium text-[#B3261E]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!strongEnough || !match || saving}
              className={`w-full py-3.5 rounded-lg font-bold text-white transition-colors ${
                strongEnough && match && !saving ? 'bg-[#1E4D2B] hover:bg-[#163B21]' : 'bg-[#1E2B23]/25 cursor-not-allowed'
              }`}
            >
              {saving ? 'Menyimpan...' : 'Simpan & Masuk'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[#5B665E] mt-5">V{APP_VERSION}</p>
      </div>
    </div>
  );
};

export default ChangePassword;
