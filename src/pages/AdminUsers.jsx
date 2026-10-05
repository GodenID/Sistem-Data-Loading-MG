import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, Users, ShieldCheck, User as UserIcon,
  Power, KeyRound, Trash2, Loader2, Copy, Check,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AppFooter from '../components/AppFooter';

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { ok: [...], fail: [...] }
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setUsers(await apiGet('/api/users'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiPost('/api/users', form);
      setForm({ username: '', password: '', name: '', role: 'staff' });
      setShowForm(false);
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      await apiPatch(`/api/users/${u.id}`, { is_active: !u.is_active });
      await fetchUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRole = async (u) => {
    try {
      await apiPatch(`/api/users/${u.id}`, { role: u.role === 'admin' ? 'staff' : 'admin' });
      await fetchUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleResetPassword = async (u) => {
    const pw = window.prompt(`Password baru untuk ${u.username} (min 6 karakter):`);
    if (!pw) return;
    try {
      await apiPatch(`/api/users/${u.id}`, { password: pw });
      alert('Password berhasil diganti');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus user ${u.username}?`)) return;
    try {
      await apiDelete(`/api/users/${u.id}`);
      await fetchUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  const randomPassword = (len = 8) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  // Format per baris: username, nama, role (role opsional, default staff)
  // Password: pakai kolom password bersama, atau acak per user jika dikosongkan.
  const handleBulk = async (e) => {
    e.preventDefault();
    setError('');
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      setError('Isi dulu daftar user (satu baris satu user)');
      return;
    }
    setBulkSaving(true);
    const ok = [];
    const fail = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      const [username, name, roleRaw] = parts;
      const role = roleRaw === 'admin' ? 'admin' : 'staff';
      if (!username) {
        fail.push({ line, message: 'Username kosong' });
        continue;
      }
      const password = bulkPassword || randomPassword();
      try {
        await apiPost('/api/users', { username, password, name: name || username, role });
        ok.push({ username, password, role, generated: !bulkPassword });
      } catch (err) {
        fail.push({ line, message: err.message });
      }
    }
    setBulkResult({ ok, fail });
    setBulkSaving(false);
    setBulkText('');
    await fetchUsers();
  };

  const copyBulkResult = async () => {
    if (!bulkResult) return;
    const text = bulkResult.ok.map((r) => `${r.username} | ${r.password} | ${r.role}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* abaikan */
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">Kelola User</h1>
            <p className="text-xs text-gray-500">Akun staff & admin</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => { setShowForm(!showForm); setShowBulk(false); }}
            className="py-3 rounded-xl border-2 border-dashed border-garden/40 bg-garden/5 text-garden-dark font-medium hover:bg-garden/10 flex items-center justify-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Satu-satu
          </button>
          <button
            onClick={() => { setShowBulk(!showBulk); setShowForm(false); }}
            className="py-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 font-medium hover:bg-blue-50 flex items-center justify-center gap-2 text-sm"
          >
            <Users className="w-4 h-4" />
            Bulk Sekaligus
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-3">
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Username"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama tampilan (untuk kolom PIC)"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden"
            />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (min 6 karakter)"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden"
            >
              <option value="staff">Staff (upload + edit)</option>
              <option value="admin">Admin (semua + hapus)</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-garden text-white font-semibold hover:bg-garden-dark disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan User
            </button>
          </form>
        )}

        {showBulk && (
          <form onSubmit={handleBulk} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-3">
            <p className="text-sm text-gray-600">
              Satu baris satu user. Format: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">username, nama, role</code> — role boleh dikosongkan (= staff).
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={'budi, Budi Santoso\nsiti, Siti Aminah, admin\nagus, Agus Wijaya'}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden font-mono text-sm"
            />
            <input
              value={bulkPassword}
              onChange={(e) => setBulkPassword(e.target.value)}
              placeholder="Password untuk semua (kosongkan = acak per user)"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-garden"
            />
            <button
              type="submit"
              disabled={bulkSaving}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Buat {bulkText.split('\n').filter((l) => l.trim()).length} User
            </button>

            {bulkResult && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">
                    Berhasil {bulkResult.ok.length}
                    {bulkResult.fail.length > 0 && ` • Gagal ${bulkResult.fail.length}`}
                  </p>
                  {bulkResult.ok.length > 0 && (
                    <button
                      type="button"
                      onClick={copyBulkResult}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Tersalin' : 'Salin'}
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto font-mono text-xs">
                  {bulkResult.ok.map((r) => (
                    <div key={r.username} className="px-4 py-2 border-b border-gray-100 flex justify-between gap-2">
                      <span className="text-green-700 truncate">{r.username} • {r.role}</span>
                      <span className="text-gray-600 shrink-0">{r.password}{r.generated ? ' (acak)' : ''}</span>
                    </div>
                  ))}
                  {bulkResult.fail.map((f, i) => (
                    <div key={i} className="px-4 py-2 border-b border-gray-100 text-red-600 truncate">
                      ✕ {f.line} — {f.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${u.role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                    {u.role === 'admin'
                      ? <ShieldCheck className="w-5 h-5 text-purple-600" />
                      : <UserIcon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {u.name || u.username}
                      {me && u.id === me.id && <span className="text-xs text-gray-400 font-normal"> (kamu)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{u.username} • {u.role}
                      {!u.is_active && <span className="text-red-500"> • nonaktif</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleToggle(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-1"
                  >
                    <Power className="w-3 h-3" />
                    {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => handleRole(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    Jadi {u.role === 'admin' ? 'staff' : 'admin'}
                  </button>
                  <button
                    onClick={() => handleResetPassword(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Reset password
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
};

export default AdminUsers;
