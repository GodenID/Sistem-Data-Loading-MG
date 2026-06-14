import { supabase } from './supabase';

/**
 * Get photo upload statistics
 * @param {Object} params
 * @param {string} params.fromDate - Start date (YYYY-MM-DD)
 * @param {string} params.toDate - End date (YYYY-MM-DD)
 * @param {string} params.groupBy - 'day', 'week', 'month'
 * @returns {Promise<Array>}
 */
export const getUploadStats = async ({ fromDate, toDate, groupBy = 'day' } = {}) => {
  let query = supabase
    .from('upload_stats')
    .select('*');

  if (fromDate) {
    query = query.gte('date', fromDate);
  }
  
  if (toDate) {
    query = query.lte('date', toDate);
  }

  const { data, error } = await query.order('date', { ascending: true });
  
  if (error) throw error;

  const stats = data || [];

  // Group data if needed
  if (groupBy === 'week') {
    return groupByWeek(stats);
  } else if (groupBy === 'month') {
    return groupByMonth(stats);
  }

  return stats;
};

/**
 * Group stats by week
 * @param {Array} stats 
 */
const groupByWeek = (stats) => {
  const grouped = stats.reduce((acc, stat) => {
    const date = new Date(stat.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!acc[weekKey]) {
      acc[weekKey] = {
        period: weekKey,
        label: `Week of ${weekKey}`,
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        total_photos: 0,
        total_size_bytes: 0
      };
    }

    acc[weekKey].total_uploads += stat.total_uploads;
    acc[weekKey].successful_uploads += stat.successful_uploads;
    acc[weekKey].failed_uploads += stat.failed_uploads;
    acc[weekKey].total_photos += stat.total_photos;
    acc[weekKey].total_size_bytes += stat.total_size_bytes;

    return acc;
  }, {});

  return Object.values(grouped);
};

/**
 * Group stats by month
 * @param {Array} stats 
 */
const groupByMonth = (stats) => {
  const grouped = stats.reduce((acc, stat) => {
    const monthKey = stat.date.substring(0, 7); // YYYY-MM

    if (!acc[monthKey]) {
      acc[monthKey] = {
        period: monthKey,
        label: new Date(monthKey + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        total_photos: 0,
        total_size_bytes: 0
      };
    }

    acc[monthKey].total_uploads += stat.total_uploads;
    acc[monthKey].successful_uploads += stat.successful_uploads;
    acc[monthKey].failed_uploads += stat.failed_uploads;
    acc[monthKey].total_photos += stat.total_photos;
    acc[monthKey].total_size_bytes += stat.total_size_bytes;

    return acc;
  }, {});

  return Object.values(grouped);
};

/**
 * Get photo upload summary
 * @param {string} fromDate 
 * @param {string} toDate 
 */
export const getUploadSummary = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from('upload_stats')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate);

  if (error) throw error;

  const stats = data || [];

  const summary = stats.reduce((acc, stat) => {
    acc.totalUploads += stat.total_uploads;
    acc.successfulUploads += stat.successful_uploads;
    acc.failedUploads += stat.failed_uploads;
    acc.totalPhotos += stat.total_photos;
    acc.totalSizeBytes += stat.total_size_bytes;
    acc.compressionRatios.push(stat.avg_compression_ratio);
    return acc;
  }, {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalPhotos: 0,
    totalSizeBytes: 0,
    compressionRatios: []
  });

  // Calculate average compression ratio
  const validRatios = summary.compressionRatios.filter(r => r !== null && r !== undefined);
  summary.avgCompressionRatio = validRatios.length > 0 
    ? validRatios.reduce((a, b) => a + b, 0) / validRatios.length 
    : 0;
  delete summary.compressionRatios;

  // Calculate success rate
  summary.successRate = summary.totalUploads > 0 
    ? ((summary.successfulUploads / summary.totalUploads) * 100).toFixed(2)
    : 0;

  // Format total size
  summary.totalSizeFormatted = formatBytes(summary.totalSizeBytes);

  return summary;
};

/**
 * Get top uploaders (companies with most uploads)
 * @param {string} fromDate 
 * @param {string} toDate 
 * @param {number} limit 
 */
export const getTopUploaders = async (fromDate, toDate, limit = 10) => {
  const { data, error } = await supabase
    .from('loading_history_reports')
    .select(`
      company_id,
      companies_reports:company_id (name),
      photo_count
    `)
    .gte('date', fromDate)
    .lte('date', toDate);

  if (error) throw error;

  const grouped = (data || []).reduce((acc, item) => {
    const companyId = item.company_id;
    const companyName = item.companies_reports?.name || 'Unknown';

    if (!acc[companyId]) {
      acc[companyId] = {
        companyId,
        companyName,
        uploadCount: 0,
        totalPhotos: 0
      };
    }

    acc[companyId].uploadCount++;
    acc[companyId].totalPhotos += item.photo_count || 0;

    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => b.uploadCount - a.uploadCount)
    .slice(0, limit);
};

/**
 * Get hourly upload distribution
 * @param {string} fromDate 
 * @param {string} toDate 
 */
export const getHourlyDistribution = async (fromDate, toDate) => {
  const { data, error } = await supabase
    .from('loading_history_reports')
    .select('created_at')
    .gte('date', fromDate)
    .lte('date', toDate);

  if (error) throw error;

  const hours = new Array(24).fill(0);
  
  (data || []).forEach(item => {
    const hour = new Date(item.created_at).getHours();
    hours[hour]++;
  });

  return hours.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    count
  }));
};

/**
 * Get comparison with previous period
 * @param {string} currentFrom 
 * @param {string} currentTo 
 */
export const getPeriodComparison = async (currentFrom, currentTo) => {
  // Calculate previous period
  const currentStart = new Date(currentFrom);
  const currentEnd = new Date(currentTo);
  const daysDiff = Math.ceil((currentEnd - currentStart) / (1000 * 60 * 60 * 24)) + 1;
  
  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - daysDiff + 1);

  const prevFrom = prevStart.toISOString().split('T')[0];
  const prevTo = prevEnd.toISOString().split('T')[0];

  const [currentStats, prevStats] = await Promise.all([
    getUploadSummary(currentFrom, currentTo),
    getUploadSummary(prevFrom, prevTo)
  ]);

  return {
    current: currentStats,
    previous: prevStats,
    changes: {
      uploads: calculateChange(prevStats.totalUploads, currentStats.totalUploads),
      photos: calculateChange(prevStats.totalPhotos, currentStats.totalPhotos),
      successRate: calculateChange(parseFloat(prevStats.successRate), parseFloat(currentStats.successRate))
    }
  };
};

/**
 * Helper: Calculate percentage change
 */
const calculateChange = (oldVal, newVal) => {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return parseFloat(((newVal - oldVal) / oldVal * 100).toFixed(2));
};

/**
 * Helper: Format bytes
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format bytes (exported)
 */
export { formatBytes };
