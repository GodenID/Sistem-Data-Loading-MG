import { supabase } from './supabase';

/**
 * Generate a secure random token
 * @param {number} length - Token length
 * @returns {string}
 */
export const generateToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Hash password using simple SHA-256 (client-side)
 * Note: For production, use bcrypt or similar on server
 * @param {string} password 
 * @returns {string}
 */
export const hashPassword = async (password) => {
  if (!password) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify password against hash
 * @param {string} password 
 * @param {string} hash 
 * @returns {boolean}
 */
export const verifyPassword = async (password, hash) => {
  if (!hash) return true; // No password required
  if (!password) return false;
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// ============================================
// COMPANY SHARE LINKS (Client Portal)
// ============================================

/**
 * Create a share link for company/client portal
 * @param {Object} params
 * @param {number} params.companyId - The company ID
 * @param {string} params.password - Optional password (null if no password)
 * @param {number} params.expiryDays - Days until expiry (null for never)
 * @returns {Promise<{token: string, url: string, expiresAt: string|null}>}
 */
export const createCompanyShareLink = async ({ companyId, password = null, expiryDays = null }) => {
  const token = generateToken(32);
  const passwordHash = password ? await hashPassword(password) : null;
  
  let expiresAt = null;
  if (expiryDays) {
    const date = new Date();
    date.setDate(date.getDate() + expiryDays);
    expiresAt = date.toISOString();
  }

  const { data, error } = await supabase
    .from('company_share_links')
    .insert([{
      company_id: companyId,
      token,
      password_hash: passwordHash,
      expires_at: expiresAt,
      is_active: true,
      access_count: 0
    }])
    .select()
    .single();

  if (error) throw error;

  // Generate full URL
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/portal/${token}`;

  return {
    token: data.token,
    url,
    expiresAt: data.expires_at,
    createdAt: data.created_at
  };
};

/**
 * Validate and get company share link data
 * @param {string} token 
 * @returns {Promise<{valid: boolean, data: Object|null, message: string}>}
 */
export const validateCompanyShareLink = async (token) => {
  const { data, error } = await supabase
    .from('company_share_links')
    .select(`
      *,
      companies_reports:company_id (*)
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return { valid: false, data: null, message: 'Link tidak ditemukan' };
  }

  if (!data.is_active) {
    return { valid: false, data: null, message: 'Link sudah dinonaktifkan' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, data: null, message: 'Link sudah kadaluarsa' };
  }

  return { 
    valid: true, 
    data,
    message: 'Link valid',
    requirePassword: !!data.password_hash
  };
};

/**
 * Access company share link with password
 * @param {string} token 
 * @param {string} password 
 * @returns {Promise<{success: boolean, data: Object|null, message: string}>}
 */
export const accessCompanyShareLink = async (token, password) => {
  const { data, error } = await supabase
    .from('company_share_links')
    .select(`
      *,
      companies_reports:company_id (*)
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return { success: false, data: null, message: 'Link tidak ditemukan' };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, data.password_hash);
  if (!passwordValid) {
    return { success: false, data: null, message: 'Password salah' };
  }

  // Increment access count
  await supabase.rpc('increment_company_share_link_access', { link_token: token });

  return { 
    success: true, 
    data,
    message: 'Akses berhasil'
  };
};

/**
 * Deactivate company share link
 * @param {number} linkId 
 */
export const deactivateCompanyShareLink = async (linkId) => {
  const { error } = await supabase
    .from('company_share_links')
    .update({ is_active: false })
    .eq('id', linkId);

  if (error) throw error;
};

/**
 * Delete company share link
 * @param {number} linkId 
 */
export const deleteCompanyShareLink = async (linkId) => {
  const { error } = await supabase
    .from('company_share_links')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
};

/**
 * Get all share links for a company
 * @param {number} companyId 
 */
export const getCompanyShareLinks = async (companyId) => {
  const { data, error } = await supabase
    .from('company_share_links')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Update company share link (password, expiry)
 * @param {number} linkId 
 * @param {Object} updates 
 */
export const updateCompanyShareLink = async (linkId, { password = undefined, expiryDays = undefined, isActive = undefined }) => {
  const updates = {};
  
  if (password !== undefined) {
    updates.password_hash = password ? await hashPassword(password) : null;
  }
  
  if (expiryDays !== undefined) {
    if (expiryDays === null) {
      updates.expires_at = null;
    } else {
      const date = new Date();
      date.setDate(date.getDate() + expiryDays);
      updates.expires_at = date.toISOString();
    }
  }
  
  if (isActive !== undefined) {
    updates.is_active = isActive;
  }

  const { data, error } = await supabase
    .from('company_share_links')
    .update(updates)
    .eq('id', linkId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Validate individual share link (for single documentation sharing)
 * @param {string} token
 * @returns {Promise<{valid: boolean, data: Object|null, message: string, requirePassword?: boolean}>}
 */
export const validateShareLink = async (token) => {
  const { data, error } = await supabase
    .from('share_links')
    .select(`
      *,
      loading_history_reports:history_id (*)
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return { valid: false, data: null, message: 'Link tidak ditemukan' };
  }

  if (!data.is_active) {
    return { valid: false, data: null, message: 'Link sudah dinonaktifkan' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, data: null, message: 'Link sudah kadaluarsa' };
  }

  return {
    valid: true,
    data,
    message: 'Link valid',
    requirePassword: !!data.password_hash
  };
};

/**
 * Access individual share link with password
 * @param {string} token
 * @param {string} password
 * @returns {Promise<{success: boolean, data: Object|null, message: string}>}
 */
export const accessShareLink = async (token, password) => {
  const { data, error } = await supabase
    .from('share_links')
    .select(`
      *,
      loading_history_reports:history_id (*)
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    return { success: false, data: null, message: 'Link tidak ditemukan' };
  }

  const passwordValid = await verifyPassword(password, data.password_hash);
  if (!passwordValid) {
    return { success: false, data: null, message: 'Password salah' };
  }

  await supabase.rpc('increment_share_link_access', { link_token: token });

  return {
    success: true,
    data,
    message: 'Akses berhasil'
  };
};
