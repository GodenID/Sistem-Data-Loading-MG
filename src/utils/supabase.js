import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration missing! Check your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions for database operations

// Companies
export const getCompanies = async ({ page, limit } = {}) => {
  let query = supabase
    .from('companies_reports')
    .select('*', { count: page && limit ? 'exact' : undefined })
    .order('name');
  
  if (page && limit) {
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  
  const result = data.map(company => ({
    ...company,
    logo_url: company.logo_url || null,
    sales_name: company.sales_name || null
  }));
  
  return page && limit ? { data: result, count } : result;
};

export const getCompanyBySlug = async (slug) => {
  const { data, error } = await supabase
    .from('companies_reports')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error) throw error;
  
  // Ensure logo_url and sales_name fields exist even if columns not in DB yet
  return {
    ...data,
    logo_url: data.logo_url || null,
    sales_name: data.sales_name || null
  };
};

// Helper function to generate slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
};

const isUniqueSlugViolation = (error) =>
  error?.code === '23505' ||
  /duplicate key|unique constraint/i.test(error?.message || '');

const MAX_SLUG_ATTEMPTS = 20;

export const addCompany = async (company) => {
  const baseSlug = company.slug || generateSlug(company.name);

  const safeFields = ['name', 'address', 'pic_name', 'contact', 'sales_name',
    'tanaman_meja', 'tanaman_lantai', 'anggrek', 'anggrek_bulan', 'anggrek_dendro',
    'planter_box', 'vertical_garden', 'mini_garden',
    'center_piece', 'pic_loading', 'slug', 'logo_url', 'category', 'notes']; // only pass known columns

  const insertData = {};
  for (const field of safeFields) {
    if (company[field] !== undefined && company[field] !== null && company[field] !== '') {
      insertData[field] = company[field];
    }
  }

  const attemptInsert = async () => {
    const { data, error } = await supabase
      .from('companies_reports')
      .insert([insertData])
      .select()
      .single();

    if (error && (error.message?.includes('does not exist') || error.message?.includes('schema cache'))) {
      const colMatch = error.message.match(/column\s+"?(\w+)"?/i);
      if (colMatch) {
        delete insertData[colMatch[1]];
        console.warn(`Column '${colMatch[1]}' not found, retrying without it`);
        return supabase
          .from('companies_reports')
          .insert([insertData])
          .select()
          .single();
      }
    }
    return { data, error };
  };

  // Retry with an incrementing suffix when the generated slug collides.
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    insertData.slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await attemptInsert();

    if (!error) return data;
    if (!isUniqueSlugViolation(error)) throw error;
  }

  throw new Error(`Gagal membuat slug unik untuk "${company.name}" setelah ${MAX_SLUG_ATTEMPTS} percobaan`);
};

export const updateCompany = async (id, updates) => {
  const safeFields = ['name', 'address', 'pic_name', 'contact', 'sales_name',
    'tanaman_meja', 'tanaman_lantai', 'anggrek', 'anggrek_bulan', 'anggrek_dendro',
    'planter_box', 'vertical_garden', 'mini_garden',
    'center_piece', 'pic_loading', 'logo_url', 'category', 'notes'];

  const updateData = {};
  for (const field of safeFields) {
    if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
      updateData[field] = updates[field];
    }
  }

  const { data, error } = await supabase
    .from('companies_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update error:', error);
    if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
      const colMatch = error.message.match(/column\s+"?(\w+)"?/i);
      if (colMatch) {
        delete updateData[colMatch[1]];
        console.warn(`Column '${colMatch[1]}' not found, retrying without it`);
        const { data: retryData, error: retryError } = await supabase
          .from('companies_reports')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData;
      }
    }
    throw error;
  }
  return data;
};

export const deleteCompany = async (id) => {
  const { error } = await supabase
    .from('companies_reports')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Loading History (includes loading and perawatan)
export const getLoadingHistory = async (filters = {}, { page, limit } = {}) => {
  let query = supabase
    .from('loading_history_reports')
    .select(`
      *,
      companies_reports:company_id (name)
    `, { count: page && limit ? 'exact' : undefined })
    .order('date', { ascending: false });
  
  if (filters.companyId) {
    query = query.eq('company_id', filters.companyId);
  }
  
  if (filters.type) {
    query = query.eq('type', filters.type);
  }
  
  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }
  
  if (page && limit) {
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  const result = data.map(item => ({
    ...item,
    companyName: item.companies_reports?.name || 'Unknown'
  }));
  
  return page && limit ? { data: result, count } : result;
};

export const addLoadingHistory = async (history) => {
  const { data, error } = await supabase
    .from('loading_history_reports')
    .insert([history])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Delete loading history and its photos
export const deleteLoadingHistory = async (historyId) => {
  const { error } = await supabase
    .from('loading_history_reports')
    .delete()
    .eq('id', historyId);
  
  if (error) throw error;
};

// Update loading history
export const updateLoadingHistory = async (id, updates) => {
  const { data, error } = await supabase
    .from('loading_history_reports')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Update photos for a history
export const updatePhotos = async (historyId, photos) => {
  // Delete existing photos
  const { error: deleteError } = await supabase
    .from('photos_reports')
    .delete()
    .eq('history_id', historyId);
  
  if (deleteError) throw deleteError;
  
  // Insert new photos
  if (photos && photos.length > 0) {
    const { data, error } = await supabase
      .from('photos_reports')
      .insert(photos)
      .select();
    
    if (error) throw error;
    return data;
  }
  
  return [];
};

// Photos
export const addPhoto = async (photo) => {
  const { data, error } = await supabase
    .from('photos_reports')
    .insert([photo])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const addPhotos = async (photos) => {
  const { data, error } = await supabase
    .from('photos_reports')
    .insert(photos)
    .select();
  
  if (error) throw error;
  return data;
};

export const deletePhotoRecord = async (photoId) => {
  const { error } = await supabase
    .from('photos_reports')
    .delete()
    .eq('id', photoId);

  if (error) throw error;
};

export const getPhotosByHistoryId = async (historyId) => {
  const { data, error } = await supabase
    .from('photos_reports')
    .select('*')
    .eq('history_id', historyId)
    .order('sort_order');
  
  if (error) throw error;
  return data;
};

// Statistics
export const getStatistics = async () => {
  // Get counts
  const { count: companiesCount, error: companiesError } = await supabase
    .from('companies_reports')
    .select('*', { count: 'exact', head: true });
  
  const { count: historyCount, error: historyError } = await supabase
    .from('loading_history_reports')
    .select('*', { count: 'exact', head: true });
  
  const { count: loadingCount, error: loadingError } = await supabase
    .from('loading_history_reports')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'loading');
  
  const { count: perawatanCount, error: perawatanError } = await supabase
    .from('loading_history_reports')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'perawatan');
  
  if (companiesError || historyError || loadingError || perawatanError) {
    throw new Error('Failed to fetch statistics');
  }
  
  return {
    totalCompanies: companiesCount,
    totalHistory: historyCount,
    totalLoading: loadingCount,
    totalPerawatan: perawatanCount
  };
};

export default supabase;
