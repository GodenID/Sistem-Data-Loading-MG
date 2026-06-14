import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Calendar,
  Image,
  Upload,
  XCircle,
  Loader2,
  Filter
} from 'lucide-react';
import { getErrorStats, getErrorRate, getRecentErrors, resolveError } from '../utils/errorTracking';
import { getUploadStats, getUploadSummary, getPeriodComparison } from '../utils/stats';
import { formatBytes } from '../utils/stats';

const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState('30'); // days
  const [isLoading, setIsLoading] = useState(true);
  const [errorStats, setErrorStats] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [recentErrors, setRecentErrors] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const handleResolveError = async (errorId) => {
    try {
      await resolveError(errorId);
      setRecentErrors(prev => prev.filter(e => e.id !== errorId));
      fetchAnalytics();
    } catch (error) {
      console.error('Error resolving:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));
      const fromDateStr = fromDate.toISOString().split('T')[0];

      const [errorData, uploadData, compareData, recentErrorsData] = await Promise.all([
        getErrorRate(fromDateStr, toDate),
        getUploadSummary(fromDateStr, toDate),
        getPeriodComparison(fromDateStr, toDate),
        getRecentErrors(5, true)
      ]);

      setErrorStats(errorData);
      setUploadStats(uploadData);
      setComparison(compareData);
      setRecentErrors(recentErrorsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-garden animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-garden" />
          <h3 className="font-bold text-gray-900">Analitik & Monitoring</h3>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-garden"
        >
          <option value="7">7 Hari Terakhir</option>
          <option value="30">30 Hari Terakhir</option>
          <option value="90">3 Bulan Terakhir</option>
        </select>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upload Count */}
        <MetricCard
          icon={Upload}
          title="Total Upload"
          value={uploadStats?.totalUploads || 0}
          change={comparison?.changes?.uploads}
          color="blue"
        />

        {/* Media Count */}
        <MetricCard
          icon={Image}
          title="Total Media"
          value={uploadStats?.totalPhotos || 0}
          change={comparison?.changes?.photos}
          color="green"
        />

        {/* Success Rate */}
        <MetricCard
          icon={CheckCircle2}
          title="Success Rate"
          value={`${uploadStats?.successRate || 0}%`}
          change={comparison?.changes?.successRate}
          color="purple"
          suffix="%"
        />

        {/* Error Rate */}
        <MetricCard
          icon={errorStats?.errorRate > 5 ? AlertTriangle : Activity}
          title="Error Rate"
          value={`${errorStats?.errorRate || 0}%`}
          change={null}
          color={errorStats?.errorRate > 5 ? 'red' : 'orange'}
          suffix="%"
          warning={errorStats?.errorRate > 5}
        />
      </div>

      {/* Detailed Stats Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Image className="w-4 h-4 text-green-500" />
            Statistik Upload
          </h4>
          <div className="space-y-4">
            <StatRow 
              label="Total Uploads"
              value={uploadStats?.totalUploads || 0}
              subtext={`${uploadStats?.successfulUploads || 0} sukses, ${uploadStats?.failedUploads || 0} gagal`}
            />
            <StatRow 
            label="Total Media"
            value={uploadStats?.totalPhotos || 0}
            subtext={`Rata-rata ${uploadStats?.totalUploads ? Math.round(uploadStats.totalPhotos / uploadStats.totalUploads) : 0} media/upload`}
            />
            <StatRow 
              label="Total Size"
              value={uploadStats?.totalSizeFormatted || '0 B'}
              subtext="Total ukuran file terupload"
            />
            <StatRow 
              label="Avg Compression"
              value={`${uploadStats?.avgCompressionRatio?.toFixed(1) || 0}%`}
              subtext="Hemat storage"
            />
          </div>
        </div>

        {/* Error Stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Error Tracking
          </h4>
          <div className="space-y-4">
            <StatRow 
              label="Total Errors"
              value={errorStats?.totalErrors || 0}
              subtext={`Dari ${errorStats?.totalUploads || 0} upload`}
            />
            <StatRow 
              label="Error Rate"
              value={`${errorStats?.errorRate || 0}%`}
              subtext={errorStats?.errorRate > 5 ? '⚠️ Perlu perhatian' : '✅ Dalam batas normal'}
              highlight={errorStats?.errorRate > 5}
            />
            <StatRow 
              label="Unresolved Errors"
              value={recentErrors?.length || 0}
              subtext="Menunggu penanganan"
            />
          </div>

          {/* Recent Errors */}
          {recentErrors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Error Terbaru:</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentErrors.slice(0, 3).map((err) => (
                  <div key={err.id} className="flex items-start gap-2 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 truncate">{err.error_message}</p>
                      <p className="text-gray-400">
                        {new Date(err.created_at).toLocaleDateString('id-ID')}
                        {' · '}
                        {err.error_type}
                      </p>
                    </div>
                    <button
                      onClick={() => handleResolveError(err.id)}
                      className="text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

// Metric Card Component
const MetricCard = ({ icon: Icon, title, value, change, color, suffix = '', warning = false }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== null && change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {change >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}{suffix}
      </p>
      <p className={`text-xs mt-1 ${warning ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
        {title}
      </p>
    </div>
  );
};

// Stat Row Component
const StatRow = ({ label, value, subtext, highlight = false }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-xs text-gray-400">{subtext}</p>
    </div>
    <p className={`text-lg font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>
      {value}
    </p>
  </div>
);

export default AnalyticsDashboard;
