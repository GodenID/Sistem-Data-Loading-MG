// Upload stats via backend REST Coolify.
import { apiGet } from './api';

export const getUploadStats = async ({ fromDate, toDate, groupBy = 'day' } = {}) => {
  const stats = await apiGet('/api/upload-stats', { from: fromDate, to: toDate });

  if (groupBy === 'week') return groupByWeek(stats);
  if (groupBy === 'month') return groupByMonth(stats);
  return stats;
};

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
        total_size_bytes: 0,
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

const groupByMonth = (stats) => {
  const grouped = stats.reduce((acc, stat) => {
    const monthKey = stat.date.substring(0, 7);

    if (!acc[monthKey]) {
      acc[monthKey] = {
        period: monthKey,
        label: new Date(`${monthKey}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        total_uploads: 0,
        successful_uploads: 0,
        failed_uploads: 0,
        total_photos: 0,
        total_size_bytes: 0,
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

export const getUploadSummary = async (fromDate, toDate) => {
  const summary = await apiGet('/api/upload-stats/summary', { from: fromDate, to: toDate });
  return {
    ...summary,
    totalSizeFormatted: formatBytes(summary.totalSizeBytes || 0),
  };
};

export const getTopUploaders = async (fromDate, toDate, limit = 10) => {
  return apiGet('/api/history/top-uploaders', { from: fromDate, to: toDate, limit });
};

export const getHourlyDistribution = async (fromDate, toDate) => {
  return apiGet('/api/history/hourly', { from: fromDate, to: toDate });
};

export const getPeriodComparison = async (currentFrom, currentTo) => {
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
    getUploadSummary(prevFrom, prevTo),
  ]);

  return {
    current: currentStats,
    previous: prevStats,
    changes: {
      uploads: calculateChange(prevStats.totalUploads, currentStats.totalUploads),
      photos: calculateChange(prevStats.totalPhotos, currentStats.totalPhotos),
      successRate: calculateChange(parseFloat(prevStats.successRate), parseFloat(currentStats.successRate)),
    },
  };
};

const calculateChange = (oldVal, newVal) => {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return parseFloat((((newVal - oldVal) / oldVal) * 100).toFixed(2));
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
