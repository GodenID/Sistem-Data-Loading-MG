import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Image,
  RotateCcw,
  LogOut,
  ChevronRight,
  TrendingUp,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  Sparkles,
  Loader2,
  HardDrive,
  Database
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { getCompanies, getLoadingHistory } from '../utils/supabase';
import BackupButton from '../components/BackupButton';
import RestoreBackup from '../components/RestoreBackup';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AppFooter from '../components/AppFooter';

// Komponen Statistik Card
const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick, isLoading }) => (
  <div 
    onClick={onClick}
    className={`
      bg-white rounded-2xl p-6 shadow-sm border border-gray-100
      ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-garden/30 transition-all duration-300' : ''}
    `}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        {isLoading ? (
          <div className="h-8 flex items-center">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        )}
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// Komponen Menu Item
const MenuItem = ({ icon: Icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="
      w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100
      flex items-center gap-4
      hover:shadow-lg hover:border-garden/30 hover:-translate-y-1
      transition-all duration-300
    "
  >
    <div className="w-14 h-14 rounded-xl bg-garden/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-7 h-7 text-garden" />
    </div>
    <div className="flex-1 text-left">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <ChevronRight className="w-5 h-5 text-gray-400" />
  </button>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAdmin();
  
  const [companies, setCompanies] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [companiesData, historyData] = await Promise.all([
          getCompanies(),
          getLoadingHistory()
        ]);
        setCompanies(companiesData);
        setLoadingHistory(historyData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Hitung statistik
  const totalClients = companies.length;
  const totalLoading = loadingHistory.filter(item => item.type === 'loading' || !item.type).length;
  const totalPerawatan = loadingHistory.filter(item => item.type === 'perawatan').length;
  const totalRotations = loadingHistory.length;
  const totalPhotos = loadingHistory.reduce((acc, item) => acc + (item.photo_count || 0), 0);
  
  // Rotasi bulan ini
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const rotationsThisMonth = loadingHistory.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
  }).length;

  // Client aktif
  const activeClientIds = new Set(loadingHistory.map(item => item.company_id));
  const activeClients = activeClientIds.size;

  // Rotasi terbaru (5 terakhir)
  const recentRotations = [...loadingHistory]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);



  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-12 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-xs text-gray-500">Mutiari Garden Report</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Selamat Datang, Admin!</h2>
          <p className="text-gray-500">Berikut ringkasan data Report Dokumentasi</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Building2}
            title="Total Client"
            value={totalClients}
            subtitle={`${activeClients} client aktif`}
            color="bg-blue-500"
            onClick={() => navigate('/admin/clients')}
            isLoading={isLoading}
          />
          <StatCard
            icon={RotateCcw}
            title="Total Dokumentasi"
            value={totalRotations}
            subtitle={`${totalLoading} Loading, ${totalPerawatan} Perawatan`}
            color="bg-purple-500"
            onClick={() => navigate('/admin/history')}
            isLoading={isLoading}
          />
          <StatCard
            icon={Image}
            title="Total Media"
            value={totalPhotos}
            subtitle="Semua dokumentasi"
            color="bg-orange-500"
            isLoading={isLoading}
          />
          <StatCard
            icon={TrendingUp}
            title="Rata-rata"
            value={Math.round(totalPhotos / totalRotations) || 0}
            subtitle="Media per dokumentasi"
            color="bg-green-500"
            isLoading={isLoading}
          />
        </div>

        {/* Menu Section */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <MenuItem
            icon={Users}
            title="Manajemen Client"
            description="Lihat dan kelola data client"
            onClick={() => navigate('/admin/clients')}
          />
          <MenuItem
            icon={RotateCcw}
            title="History Dokumentasi"
            description="Lihat semua riwayat loading & perawatan"
            onClick={() => navigate('/admin/history')}
          />
          <MenuItem
            icon={ShieldCheck}
            title="Kelola User"
            description="Akun staff & admin, reset password"
            onClick={() => navigate('/admin/users')}
          />
          <MenuItem
            icon={Users}
            title="Performa Tim"
            description="Siapa loading berapa kali"
            onClick={() => navigate('/admin/team')}
          />
          <MenuItem
            icon={Image}
            title="Galeri"
            description="Semua foto & video"
            onClick={() => navigate('/galeri')}
          />
        </div>

        {/* Analytics Dashboard - Error Rate & Upload Stats */}
        <div className="mb-8">
          <AnalyticsDashboard />
        </div>

        {/* Backup & Restore Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Backup Data</h3>
            </div>
            <BackupButton />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-gray-900">Restore Data</h3>
            </div>
            <RestoreBackup />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-garden" />
              <h3 className="font-bold text-gray-900">Aktivitas Terbaru</h3>
            </div>
            <button
              onClick={() => navigate('/admin/history')}
              className="text-sm text-garden hover:text-garden-dark font-medium"
            >
              Lihat Semua
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Memuat data...</p>
              </div>
            ) : recentRotations.length > 0 ? (
              recentRotations.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${item.type === 'perawatan' ? 'bg-blue-100' : 'bg-garden/10'}
                  `}>
                    {item.type === 'perawatan' ? (
                      <Sparkles className="w-5 h-5 text-blue-600" />
                    ) : (
                      <RotateCcw className="w-5 h-5 text-garden" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{item.companyName}</p>
                      {item.type === 'perawatan' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          Perawatan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {item.type === 'perawatan' ? 'Perawatan Oleh: ' : ''}{item.pic}
                      </span>
                      <span className="flex items-center gap-1">
                        <Image className="w-3.5 h-3.5" />
                        {item.photo_count || 0} media
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(item.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                Belum ada aktivitas
              </div>
            )}
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
};

export default AdminDashboard;
