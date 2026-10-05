// Error tracking via backend REST Coolify.
import { apiGet, apiPost, apiPatch } from './api';

export const logError = async ({
  type = 'other',
  message,
  companyId = null,
  historyId = null,
  context = {},
}) => {
  try {
    await apiPost('/api/upload-stats/errors', {
      type,
      message,
      company_id: companyId,
      history_id: historyId,
      context,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (e) {
    console.error('Error logging failed:', e);
  }
};

export const getErrorStats = async ({ fromDate, toDate, type = null } = {}) => {
  return apiGet('/api/upload-stats/errors/stats', { from: fromDate, to: toDate, type });
};

export const getErrorRate = async (fromDate, toDate) => {
  return apiGet('/api/upload-stats/error-rate', { from: fromDate, to: toDate });
};

export const resolveError = async (errorId) => {
  await apiPatch(`/api/upload-stats/errors/${errorId}/resolve`, {});
};

export const getRecentErrors = async (limit = 10, unresolvedOnly = false) => {
  const data = await apiGet('/api/upload-stats/errors/recent', {
    limit,
    unresolvedOnly: unresolvedOnly ? 'true' : undefined,
  });
  return data || [];
};

export const trackUploadAttempt = async (success, details = {}) => {
  try {
    await apiPost('/api/upload-stats/track', {
      success,
      photoCount: details.photoCount || 0,
      totalSize: details.totalSize || 0,
      compressionRatio: details.compressionRatio || null,
    });
  } catch (e) {
    console.error('Failed to track upload:', e);
  }
};

export const ERROR_TYPES = {
  UPLOAD: 'upload',
  COMPRESSION: 'compression',
  NETWORK: 'network',
  DATABASE: 'database',
  VALIDATION: 'validation',
  OTHER: 'other',
};
