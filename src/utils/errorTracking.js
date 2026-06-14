import { supabase } from './supabase';

/**
 * Log an error to the database
 * @param {Object} params
 * @param {string} params.type - Error type: 'upload', 'compression', 'network', 'database', 'validation', 'other'
 * @param {string} params.message - Error message
 * @param {number} params.companyId - Optional company ID
 * @param {number} params.historyId - Optional history ID
 * @param {Object} params.context - Additional context (fileSize, browser, etc.)
 */
export const logError = async ({ 
  type = 'other', 
  message, 
  companyId = null, 
  historyId = null, 
  context = {} 
}) => {
  try {
    const errorData = {
      error_type: type,
      error_message: message,
      company_id: companyId,
      history_id: historyId,
      context: context,
      user_agent: navigator.userAgent,
      resolved: false
    };

    const { error } = await supabase
      .from('error_logs')
      .insert([errorData]);

    if (error) {
      console.error('Failed to log error:', error);
    }
  } catch (e) {
    // Silent fail - don't break the app if error logging fails
    console.error('Error logging failed:', e);
  }
};

/**
 * Get error statistics
 * @param {Object} params
 * @param {string} params.fromDate - Start date (YYYY-MM-DD)
 * @param {string} params.toDate - End date (YYYY-MM-DD)
 * @param {string} params.type - Optional error type filter
 * @returns {Promise<{total: number, byType: Object, trend: Array}>}
 */
export const getErrorStats = async ({ fromDate, toDate, type = null } = {}) => {
  let query = supabase
    .from('error_logs')
    .select('*');

  if (fromDate) {
    query = query.gte('created_at', `${fromDate}T00:00:00Z`);
  }
  
  if (toDate) {
    query = query.lte('created_at', `${toDate}T23:59:59Z`);
  }
  
  if (type) {
    query = query.eq('error_type', type);
  }

  const { data, error } = await query;
  
  if (error) throw error;

  const errors = data || [];
  
  // Group by type
  const byType = errors.reduce((acc, err) => {
    acc[err.error_type] = (acc[err.error_type] || 0) + 1;
    return acc;
  }, {});

  // Group by date for trend
  const trend = errors.reduce((acc, err) => {
    const date = new Date(err.created_at).toISOString().split('T')[0];
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ date, count: 1 });
    }
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date));

  // Get unresolved count
  const unresolved = errors.filter(e => !e.resolved).length;

  return {
    total: errors.length,
    byType,
    trend,
    unresolved
  };
};

/**
 * Get error rate (errors vs total uploads)
 * @param {string} fromDate 
 * @param {string} toDate 
 * @returns {Promise<{errorRate: number, totalErrors: number, totalUploads: number}>}
 */
export const getErrorRate = async (fromDate, toDate) => {
  // Get error count
  const { data: errorData } = await supabase
    .from('error_logs')
    .select('id', { count: 'exact' })
    .gte('created_at', `${fromDate}T00:00:00Z`)
    .lte('created_at', `${toDate}T23:59:59Z`);

  // Get upload count from upload_stats
  const { data: uploadData } = await supabase
    .from('upload_stats')
    .select('total_uploads')
    .gte('date', fromDate)
    .lte('date', toDate);

  const totalErrors = errorData?.length || 0;
  const totalUploads = uploadData?.reduce((sum, stat) => sum + (stat.total_uploads || 0), 0) || 0;
  
  const errorRate = totalUploads > 0 ? (totalErrors / totalUploads) * 100 : 0;

  return {
    errorRate: parseFloat(errorRate.toFixed(2)),
    totalErrors,
    totalUploads
  };
};

/**
 * Mark error as resolved
 * @param {number} errorId 
 */
export const resolveError = async (errorId) => {
  const { error } = await supabase
    .from('error_logs')
    .update({ resolved: true })
    .eq('id', errorId);

  if (error) throw error;
};

/**
 * Get recent errors
 * @param {number} limit 
 * @param {boolean} unresolvedOnly 
 */
export const getRecentErrors = async (limit = 10, unresolvedOnly = false) => {
  let query = supabase
    .from('error_logs')
    .select(`
      *,
      companies_reports:company_id (name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unresolvedOnly) {
    query = query.eq('resolved', false);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
};

/**
 * Track upload attempt for stats
 * @param {boolean} success 
 * @param {Object} details 
 */
export const trackUploadAttempt = async (success, details = {}) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Try to update existing record
    const { data: existing } = await supabase
      .from('upload_stats')
      .select('*')
      .eq('date', today)
      .single();

    if (existing) {
      const updates = {
        total_uploads: existing.total_uploads + 1,
        successful_uploads: existing.successful_uploads + (success ? 1 : 0),
        failed_uploads: existing.failed_uploads + (success ? 0 : 1),
        total_photos: existing.total_photos + (details.photoCount || 0),
        total_size_bytes: existing.total_size_bytes + (details.totalSize || 0)
      };

      await supabase
        .from('upload_stats')
        .update(updates)
        .eq('id', existing.id);
    } else {
      // Create new record
      await supabase
        .from('upload_stats')
        .insert([{
          date: today,
          total_uploads: 1,
          successful_uploads: success ? 1 : 0,
          failed_uploads: success ? 0 : 1,
          total_photos: details.photoCount || 0,
          total_size_bytes: details.totalSize || 0,
          avg_compression_ratio: details.compressionRatio || null
        }]);
    }
  } catch (e) {
    console.error('Failed to track upload:', e);
  }
};

/**
 * Error types constant
 */
export const ERROR_TYPES = {
  UPLOAD: 'upload',
  COMPRESSION: 'compression',
  NETWORK: 'network',
  DATABASE: 'database',
  VALIDATION: 'validation',
  OTHER: 'other'
};
