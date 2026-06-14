-- ============================================
-- Migration: Add Share Links & Analytics Tables
-- ============================================

-- ============================================
-- TABLE: share_links
-- Store public share links for documentation
-- ============================================
CREATE TABLE IF NOT EXISTS share_links (
    id SERIAL PRIMARY KEY,
    history_id INTEGER NOT NULL REFERENCES loading_history_reports(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL means no password protection
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expire
    is_active BOOLEAN DEFAULT TRUE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES companies_reports(id) -- track who created (optional)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_history_id ON share_links(history_id);
CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_share_links_is_active ON share_links(is_active);

-- ============================================
-- TABLE: error_logs
-- Track upload errors and failures
-- ============================================
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(50) NOT NULL, -- 'upload', 'compression', 'network', 'database', 'validation'
    error_message TEXT,
    company_id INTEGER REFERENCES companies_reports(id),
    history_id INTEGER REFERENCES loading_history_reports(id),
    context JSONB, -- store additional context like file size, browser info, etc.
    user_agent TEXT,
    ip_address INET,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- ============================================
-- TABLE: upload_stats
-- Track photo upload statistics
-- ============================================
CREATE TABLE IF NOT EXISTS upload_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_uploads INTEGER DEFAULT 0,
    successful_uploads INTEGER DEFAULT 0,
    failed_uploads INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    avg_compression_ratio DECIMAL(5,2), -- percentage saved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_stats_date ON upload_stats(date);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_upload_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_upload_stats_updated_at ON upload_stats;
CREATE TRIGGER update_upload_stats_updated_at
    BEFORE UPDATE ON upload_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_upload_stats_updated_at();

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_stats ENABLE ROW LEVEL SECURITY;

-- Policies for share_links
CREATE POLICY "Allow all read" ON share_links FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON share_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON share_links FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON share_links FOR DELETE USING (true);

-- Policies for error_logs
CREATE POLICY "Allow all" ON error_logs FOR ALL USING (true) WITH CHECK (true);

-- Policies for upload_stats
CREATE POLICY "Allow all" ON upload_stats FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- VIEW: share_links_with_history
-- For easier querying
-- ============================================
CREATE OR REPLACE VIEW share_links_with_history AS
SELECT 
    sl.*,
    lh.date as history_date,
    lh.pic,
    lh.type,
    lh.photo_count,
    lh.catatan,
    c.name as company_name,
    c.slug as company_slug
FROM share_links sl
JOIN loading_history_reports lh ON sl.history_id = lh.id
JOIN companies_reports c ON lh.company_id = c.id;

-- ============================================
-- FUNCTION: Increment share link access count
-- ============================================
CREATE OR REPLACE FUNCTION increment_share_link_access(link_token VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE share_links 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE token = link_token;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETION
-- ============================================
SELECT 'Migration completed: Share links and analytics tables created!' as status;
