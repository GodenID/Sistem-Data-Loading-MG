// Compat layer: nama file & export dipertahankan (supabase.js) agar
// semua pages/components tidak perlu diubah, tapi di dalamnya sudah
// bicara ke backend REST Coolify via src/utils/api.js — bukan Supabase.
//
// Env yang dipakai sekarang: VITE_API_URL (lihat .env.example)
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sudah tidak dipakai.

import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './api';

// Stub agar import { supabase } yang tersisa tidak crash.
// Jangan dipakai untuk query baru — pakai fungsi di bawah.
export const supabase = {
  from() {
    throw new Error('supabase-js sudah dilepas. Pakai fungsi REST di src/utils/supabase.js');
  },
  rpc() {
    throw new Error('supabase-js sudah dilepas. Pakai fungsi REST di src/utils/supabase.js');
  },
};

// ---------- Companies ----------

export const getCompanies = async ({ page, limit, search } = {}) => {
  const res = await apiGet('/api/companies', { page, limit, search });
  if (page && limit) {
    return {
      data: (res.data || []).map((c) => ({ ...c, logo_url: c.logo_url || null, sales_name: c.sales_name || null })),
      count: res.count ?? 0,
    };
  }
  return (res || []).map((c) => ({ ...c, logo_url: c.logo_url || null, sales_name: c.sales_name || null }));
};

export const getCompanyBySlug = async (slug) => {
  const data = await apiGet(`/api/companies/slug/${encodeURIComponent(slug)}`);
  return { ...data, logo_url: data.logo_url || null, sales_name: data.sales_name || null };
};

export const getActivityHeatmap = async (days = 90) => {
  return apiGet('/api/history/heatmap', { days });
};

export const getCompaniesCount = async () => {
  const res = await apiGet('/api/companies/count');
  return res.count ?? 0;
};

export const getActiveCompanyIds = async (companyIds = [], sinceDate) => {
  if (!companyIds.length || !sinceDate) return [];
  return apiGet('/api/companies/active', { ids: companyIds.join(','), since: sinceDate });
};

export const addCompany = async (company) => {
  return apiPost('/api/companies', company);
};

export const updateCompany = async (id, updates) => {
  return apiPatch(`/api/companies/${id}`, updates);
};

export const deleteCompany = async (id) => {
  await apiDelete(`/api/companies/${id}`);
};

// ---------- Loading History ----------

export const getLoadingHistory = async (filters = {}, { page, limit } = {}) => {
  const query = {
    companyId: filters.companyId,
    companyIds: Array.isArray(filters.companyIds) ? filters.companyIds.join(',') : undefined,
    picSearch: filters.picSearch,
    type: filters.type,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    crewUserId: filters.crewUserId,
    code: filters.code,
    page,
    limit,
  };
  const res = await apiGet('/api/history', query);
  if (page && limit) return res;
  return res;
};

export const getLoadingHistorySummary = async (filters = {}) => {
  return apiGet('/api/history/summary', {
    companyId: filters.companyId,
    companyIds: Array.isArray(filters.companyIds) ? filters.companyIds.join(',') : undefined,
    picSearch: filters.picSearch,
    type: filters.type,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    crewUserId: filters.crewUserId,
    code: filters.code,
  });
};

export const checkLoadingDuplicate = async (companyId, date, type, excludeId = null) => {
  const res = await apiGet('/api/history/check-duplicate', { companyId, date, type, excludeId });
  return !!res.duplicate;
};

// Kembalikan record yang bentrok (untuk modal blokir duplikat), atau null.
export const findLoadingDuplicate = async (companyId, date, type, excludeId = null) => {
  const res = await apiGet('/api/history/check-duplicate', { companyId, date, type, excludeId });
  return res.duplicate ? res.record || null : null;
};

export const addLoadingHistory = async (history) => {
  return apiPost('/api/history', history);
};

export const deleteLoadingHistory = async (historyId) => {
  await apiDelete(`/api/history/${historyId}`);
};

export const updateLoadingHistory = async (id, updates) => {
  return apiPatch(`/api/history/${id}`, updates);
};

export const updatePhotos = async (historyId, photos) => {
  return apiPut(`/api/history/${historyId}/photos`, photos);
};

// ---------- Photos ----------

export const addPhoto = async (photo) => {
  return apiPost('/api/photos', photo);
};

export const addPhotos = async (photos) => {
  return apiPost('/api/photos', photos);
};

export const deletePhotoRecord = async (photoId) => {
  await apiDelete(`/api/photos/${photoId}`);
};

export const getPhotosByHistoryId = async (historyId) => {
  return apiGet(`/api/history/${historyId}/photos`);
};

// ---------- Tim (crew per dokumentasi) ----------

export const getTeam = async (search = '') => {
  return apiGet('/api/team', search ? { search } : {});
};

export const getTeamStats = async () => {
  return apiGet('/api/team/stats');
};

export const getMemberHistory = async (userId, limit = 20) => {
  return apiGet(`/api/team/${userId}/history`, { limit });
};

export const getHistoryCrew = async (historyId) => {
  return apiGet(`/api/history/${historyId}/crew`);
};

export const setHistoryCrew = async (historyId, userIds) => {
  return apiPost(`/api/history/${historyId}/crew`, { userIds });
};

// ---------- Galeri ----------

export const getGallery = async (filters = {}, { page = 1, limit = 60 } = {}) => {
  return apiGet('/api/photos/gallery', {
    companyId: filters.companyId,
    type: filters.type,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    crewUserId: filters.crewUserId,
    page,
    limit,
  });
};

// ---------- Statistics ----------

export const getStatistics = async () => {
  return apiGet('/api/history/stats');
};

export default supabase;
