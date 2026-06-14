import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Link2, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Lock, 
  Unlock,
  Trash2,
  Loader2,
  ExternalLink,
  Eye,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Building2,
  Globe
} from 'lucide-react';
import { 
  createCompanyShareLink, 
  getCompanyShareLinks, 
  deactivateCompanyShareLink, 
  deleteCompanyShareLink,
  updateCompanyShareLink
} from '../utils/shareLink';

const ShareLinkModal = ({ isOpen, onClose, companyId, companyName, companyData }) => {
  const [shareLinks, setShareLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState('');
  
  // Form states
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchShareLinks();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const fetchShareLinks = async () => {
    try {
      setIsLoading(true);
      const links = await getCompanyShareLinks(companyId);
      setShareLinks(links);
    } catch (err) {
      console.error('Error fetching share links:', err);
      setError('Gagal memuat data share link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (enablePassword && !password.trim()) {
      setError('Password tidak boleh kosong');
      return;
    }

    try {
      setIsCreating(true);
      setError('');

      const result = await createCompanyShareLink({
        companyId,
        password: enablePassword ? password : null,
        expiryDays: enableExpiry ? expiryDays : null
      });

      // Refresh list
      await fetchShareLinks();
      
      // Reset form
      setShowCreateForm(false);
      setPassword('');
      setEnablePassword(false);
      setEnableExpiry(false);
      
      // Auto copy new link
      copyToClipboard(result.url, 'new');
    } catch (err) {
      console.error('Error creating share link:', err);
      setError('Gagal membuat share link');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (link) => {
    try {
      await updateCompanyShareLink(link.id, { isActive: !link.is_active });
      await fetchShareLinks();
    } catch (err) {
      console.error('Error toggling link:', err);
      setError('Gagal mengubah status link');
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus link ini?')) return;
    
    try {
      await deleteCompanyShareLink(linkId);
      await fetchShareLinks();
    } catch (err) {
      console.error('Error deleting link:', err);
      setError('Gagal menghapus link');
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatExpiry = (expiresAt) => {
    if (!expiresAt) return 'Tidak ada';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Kadaluarsa';
    if (diffDays === 0) return 'Kadaluarsa hari ini';
    if (diffDays === 1) return '1 hari lagi';
    return `${diffDays} hari lagi`;
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <div 
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[90vh] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Portal Client</h2>
              <p className="text-xs text-gray-500">Share link untuk client</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                <Building2 className="w-5 h-5 text-garden" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{companyName}</p>
                <p className="text-xs text-gray-500">
                  Client dapat melihat semua dokumentasi
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Create New Link Button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-600 font-medium hover:bg-blue-50 hover:border-blue-400 transition-all mb-6 flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              Buat Portal Link Baru
            </button>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-blue-50/50 rounded-xl p-4 mb-6 border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                Pengaturan Portal
              </h3>

              {/* Password Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setEnablePassword(!enablePassword)}
                  className="flex items-center justify-between w-full p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {enablePassword ? (
                      <Lock className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Unlock className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700">Password Protection</span>
                  </div>
                  {enablePassword ? (
                    <ToggleRight className="w-6 h-6 text-blue-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>

                {enablePassword && (
                  <div className="mt-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password untuk client..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Client harus memasukkan password sebelum melihat dokumentasi
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setEnableExpiry(!enableExpiry)}
                  className="flex items-center justify-between w-full p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${enableExpiry ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-700">Kadaluarsa Otomatis</span>
                  </div>
                  {enableExpiry ? (
                    <ToggleRight className="w-6 h-6 text-blue-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>

                {enableExpiry && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">hari</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleCreateLink}
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Membuat...</>
                  ) : (
                    <><Globe className="w-4 h-4" /> Buat Portal Link</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Existing Links */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gray-400" />
              Link Aktif ({shareLinks.filter(l => l.is_active && !isExpired(l.expires_at)).length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
              </div>
            ) : shareLinks.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Globe className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Belum ada portal link</p>
                <p className="text-xs text-gray-400">Buat link untuk membagikan portal ke client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shareLinks.map((link) => {
                  const expired = isExpired(link.expires_at);
                  const fullUrl = `${window.location.origin}/portal/${link.token}`;
                  
                  return (
                    <div 
                      key={link.id}
                      className={`p-4 rounded-xl border ${
                        !link.is_active || expired 
                          ? 'bg-gray-50 border-gray-200 opacity-60' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Globe className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-mono text-gray-500 truncate">
                              {link.token.substring(0, 20)}...
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {link.password_hash && (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Password
                              </span>
                            )}
                            {link.expires_at && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                expired 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                <Clock className="w-3 h-3" /> {formatExpiry(link.expires_at)}
                              </span>
                            )}
                            {!link.expires_at && (
                              <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                Permanent
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(fullUrl, link.id)}
                            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                            title="Copy link"
                          >
                            {copiedId === link.id ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
                            title="Buka link"
                          >
                            <ExternalLink className="w-4 h-4 text-blue-600" />
                          </a>
                          <button
                            onClick={() => handleToggleActive(link)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              link.is_active 
                                ? 'bg-green-100 hover:bg-green-200' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            title={link.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {link.is_active ? (
                              <ToggleRight className="w-4 h-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {link.access_count} akses
                        </span>
                        {link.last_accessed_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Terakhir: {new Date(link.last_accessed_at).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Portal link memungkinkan client melihat semua dokumentasi mereka tanpa login.
            <br />
            Link dengan password memberikan lapisan keamanan tambahan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareLinkModal;
