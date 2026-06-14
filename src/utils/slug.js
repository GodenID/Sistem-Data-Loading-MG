/**
 * Convert string to SEO-friendly slug
 * @param {string} text - Text to convert
 * @returns {string} SEO-friendly slug
 */
export const createSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

/**
 * Find company by slug
 * @param {Array} companies - Array of companies
 * @param {string} slug - Slug to find
 * @returns {Object|null} Company object or null
 */
export const findCompanyBySlug = (companies, slug) => {
  return companies.find(company => createSlug(company.name) === slug) || null;
};
