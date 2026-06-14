import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Shield, Users, Package, Image, Clock, RotateCcw, Sparkles, User, CheckCircle2, ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import CompanyCard from '../components/CompanyCard';
import HomePasswordModal from '../components/HomePasswordModal';
import Skeleton from '../components/Skeleton';
import AnimatedCounter from '../components/AnimatedCounter';
import { getCompanies, getLoadingHistory } from '../utils/supabase';
import { createSlug } from '../utils/slug';

const Home = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalHistory: 0,
    totalPhotos: 0
  });

  // State untuk rentang tanggal (date range)
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Format tanggal untuk display
  const formatDateDisplay = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Cek apakah rentang tanggal adalah hari ini saja
  const isTodayRange = () => {
    return startDate === today && endDate === today;
  };

  // Preset rentang tanggal
  const setToday = () => {
    setStartDate(today);
    setEndDate(today);
  };

  const setLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  // Filter history berdasarkan rentang tanggal
  const getRotationsInRange = () => {
    return history.filter(item => item.date >= startDate && item.date <= endDate);
  };

  // Handle click pada item rotasi untuk menuju detail client
  const handleRotationClick = (companyName) => {
    const company = companies.find(c => c.name === companyName);
    if (company) {
      const slug = company.slug || createSlug(company.name);
      navigate(`/client/${slug}`);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const auth = sessionStorage.getItem('homeAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch data from Supabase
  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [companiesData, historyData] = await Promise.all([
        getCompanies(),
        getLoadingHistory()
      ]);

      setCompanies(companiesData || []);
      setHistory(historyData || []);

      // Calculate stats
      const totalPhotos = historyData?.reduce((acc, item) => acc + (item.photo_count || 0), 0) || 0;
      setStats({
        totalCompanies: companiesData?.length || 0,
        totalHistory: historyData?.length || 0,
        totalPhotos: totalPhotos
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);
  
  // Refresh data when window regains focus (user returns from admin)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

  const companiesWithStatus = useMemo(() => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    return companies.map(company => {
      const latestDoc = [...history]
        .filter(h => h.company_id === company.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const isActive = !!latestDoc && new Date(latestDoc.date) >= twoMonthsAgo;
      return { ...company, isActive };
    });
  }, [companies, history]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return companiesWithStatus.filter(company => 
      (company.name || '').toLowerCase().includes(query) ||
      (company.address || '').toLowerCase().includes(query)
    );
  }, [companiesWithStatus, searchQuery]);

  // Show password modal if not authenticated
  if (!isAuthenticated) {
    return <HomePasswordModal onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-garden-light/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Mutiari Garden" 
                className="h-14 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Mutiari Garden</h1>
                <p className="text-xs text-gray-500">Report Dokumentasi</p>
              </div>
            </div>
            <a
              href="#/admin/login"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/admin/login';
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalCompanies} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Perusahaan</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-garden/10 flex items-center justify-center mx-auto mb-2">
              <Package className="w-5 h-5 text-garden" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalHistory} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Dokumentasi</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2">
              <Image className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              <AnimatedCounter end={stats.totalPhotos} duration={1500} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Media</p>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Cari Data Perusahaan
          </h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm sm:text-base">
            Masukkan nama perusahaan untuk melihat detail dan menginput data loading
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-6 sm:mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Ketik nama perusahaan..."
          />
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {!searchQuery.trim() ? (
            // Empty State - No search yet
            <div className="text-center py-12 sm:py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">Mulai ketik untuk mencari perusahaan</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton.Card key={i} />
              ))}
            </div>
          ) : filteredCompanies.length === 0 ? (
            // No Results State
            <div className="text-center py-12 sm:py-16">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-red-300" />
              </div>
              <p className="text-gray-500 font-medium mb-1">Tidak ada hasil</p>
              <p className="text-sm text-gray-400">
                Coba kata kunci lain atau periksa ejaan
              </p>
            </div>
          ) : (
            // Results List
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-gray-500">
                  Ditemukan <span className="font-semibold text-gray-700">{filteredCompanies.length}</span> perusahaan
                </p>
              </div>
              <div className="space-y-3">
                {filteredCompanies.map((company, index) => (
                  <CompanyCard 
                    key={company.id} 
                    company={company} 
                    index={index}
                    isActive={company.isActive}
                    category={company.category}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tracking Rotasi Section */}
        {!searchQuery.trim() && (
          <div className="mt-8">
            <div className="bg-gradient-to-br from-garden/5 to-blue-50 rounded-2xl shadow-sm border border-garden/20 overflow-hidden">
              <div className="p-5 border-b border-garden/10 bg-white/50">
                {/* Header dengan Date Range */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-garden flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        Tracking Rotasi {isTodayRange() ? 'Hari Ini' : ''}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatDateDisplay(startDate)} {startDate !== endDate && ` - ${formatDateDisplay(endDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-garden">
                      {getRotationsInRange().length}
                    </span>
                    <span className="text-sm text-gray-500">rotasi</span>
                  </div>
                </div>

                {/* Date Range Picker Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-garden/10">
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={setToday}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isTodayRange()
                          ? 'bg-garden text-white'
                          : 'bg-white border border-garden/20 text-garden hover:bg-garden/10'
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      onClick={setLast7Days}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      7 Hari
                    </button>
                    <button
                      onClick={setLast30Days}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      30 Hari
                    </button>
                    <button
                      onClick={setThisMonth}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-garden/20 text-gray-600 hover:bg-garden/10 transition-colors"
                    >
                      Bulan Ini
                    </button>
                  </div>
                  
                  {/* Date Inputs */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate}
                      className="px-2 py-1.5 rounded-lg border border-garden/20 text-xs focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white w-28"
                    />
                    <span className="text-gray-400 text-xs">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="px-2 py-1.5 rounded-lg border border-garden/20 text-xs focus:outline-none focus:border-garden focus:ring-2 focus:ring-garden/10 bg-white w-28"
                    />
                  </div>
                </div>
              </div>

              {/* Date Range Stats */}
              {(() => {
                const rangeRotations = getRotationsInRange();
                const rangeLoading = rangeRotations.filter(item => item.type === 'loading' || !item.type);
                const rangePerawatan = rangeRotations.filter(item => item.type === 'perawatan');
                const rangePhotos = rangeRotations.reduce((acc, item) => acc + (item.photo_count || 0), 0);
                
                // Group by date untuk menampilkan tanggal
                const groupedByDate = rangeRotations.reduce((acc, item) => {
                  if (!acc[item.date]) acc[item.date] = [];
                  acc[item.date].push(item);
                  return acc;
                }, {});
                
                // Sort dates descending
                const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

                return (
                  <>
                    <div className="grid grid-cols-3 gap-4 p-4 bg-white/30">
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-garden/10">
                        <p className="text-2xl font-bold text-garden">{rangeLoading.length}</p>
                        <p className="text-xs text-gray-500">Loading</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-blue-200">
                        <p className="text-2xl font-bold text-blue-600">{rangePerawatan.length}</p>
                        <p className="text-xs text-gray-500">Perawatan</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white shadow-sm border border-orange-200">
                        <p className="text-2xl font-bold text-orange-600">{rangePhotos}</p>
                <p className="text-xs text-gray-500">Total Media</p>
                      </div>
                    </div>

                    {/* Date Range Rotation List - Grouped by Date */}
                    <div className="divide-y divide-garden/10 max-h-[500px] overflow-y-auto">
                      {loading ? (
                        <div className="p-6 space-y-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rangeRotations.length > 0 ? (
                        sortedDates.map(date => (
                          <div key={date}>
                            {/* Date Header */}
                            <div className="px-4 py-2 bg-gray-50/80 border-y border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {new Date(date).toLocaleDateString('id-ID', {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                            {/* Items for this date */}
                            {groupedByDate[date]
                              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                              .map((item) => (
                                <div 
                                  key={item.id} 
                                  onClick={() => handleRotationClick(item.companyName)}
                                  className="p-4 flex items-center gap-4 hover:bg-white/50 transition-colors cursor-pointer"
                                >
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
                                      {item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'}
                                    </p>
                                    <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Selesai
                                    </p>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <MapPin className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 font-medium">
                            Belum ada rotasi pada rentang tanggal ini
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Pilih rentang tanggal lain
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-400">
            © 2026 Mutiari Garden. Report Dokumentasi System.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
