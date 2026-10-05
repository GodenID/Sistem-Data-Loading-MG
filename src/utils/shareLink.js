// Share links via backend REST Coolify (dulu via supabase-js).
import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export const generateToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const hashPassword = async (password) => {
  if (!password) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const verifyPassword = async (password, hash) => {
  if (!hash) return true;
  if (!password) return false;
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// ---------- COMPANY SHARE LINKS ----------

export const createCompanyShareLink = async ({ companyId, password = null, expiryDays = null }) => {
  const password_hash = password ? await hashPassword(password) : null;
  const data = await apiPost('/api/company-share-links', {
    company_id: companyId,
    password_hash,
    expiryDays,
  });
  const baseUrl = window.location.origin;
  return {
    token: data.token,
    url: `${baseUrl}/portal/${data.token}`,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
};

export const validateCompanyShareLink = async (token) => {
  try {
    return await apiGet(`/api/company-share-links/token/${encodeURIComponent(token)}`);
  } catch {
    return { valid: false, data: null, message: 'Link tidak ditemukan' };
  }
};

export const accessCompanyShareLink = async (token, password) => {
  const password_hash = password ? await hashPassword(password) : null;
  try {
    // kirim hash (backend bandingkan string) — password mentah tidak dikirim
    return await apiPost(`/api/company-share-links/token/${encodeURIComponent(token)}/access`, {
      password_hash,
    });
  } catch (e) {
    return { success: false, data: null, message: e.message || 'Link tidak ditemukan' };
  }
};

export const deactivateCompanyShareLink = async (linkId) => {
  await apiPatch(`/api/company-share-links/${linkId}`, { is_active: false });
};

export const deleteCompanyShareLink = async (linkId) => {
  await apiDelete(`/api/company-share-links/${linkId}`);
};

export const getCompanyShareLinks = async (companyId) => {
  const data = await apiGet('/api/company-share-links', { companyId });
  return data || [];
};

export const updateCompanyShareLink = async (linkId, { password = undefined, expiryDays = undefined, isActive = undefined }) => {
  const body = {};
  if (password !== undefined) body.password_hash = password ? await hashPassword(password) : null;
  if (expiryDays !== undefined) body.expiryDays = expiryDays;
  if (isActive !== undefined) body.is_active = isActive;
  return apiPatch(`/api/company-share-links/${linkId}`, body);
};

// ---------- SINGLE-DOC SHARE LINKS ----------

export const createShareLink = async ({ historyId, password = null, expiryDays = null }) => {
  const password_hash = password ? await hashPassword(password) : null;
  const data = await apiPost('/api/share-links', { history_id: historyId, password_hash, expiryDays });
  const baseUrl = window.location.origin;
  return {
    token: data.token,
    url: `${baseUrl}/share/${data.token}`,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
};

export const validateShareLink = async (token) => {
  try {
    return await apiGet(`/api/share-links/token/${encodeURIComponent(token)}`);
  } catch {
    return { valid: false, data: null, message: 'Link tidak ditemukan' };
  }
};

export const accessShareLink = async (token, password) => {
  const password_hash = password ? await hashPassword(password) : null;
  try {
    return await apiPost(`/api/share-links/token/${encodeURIComponent(token)}/access`, { password_hash });
  } catch (e) {
    return { success: false, data: null, message: e.message || 'Link tidak ditemukan' };
  }
};
