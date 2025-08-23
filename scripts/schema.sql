-- Super Linter API Database Schema
-- SQLite database for caching, job tracking, and metrics

-- Cache table for linting results
CREATE TABLE IF NOT EXISTS lint_results (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    linter_type TEXT NOT NULL,
    options_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('json', 'text', 'sarif')),
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

-- Indexes for lint_results
CREATE INDEX IF NOT EXISTS idx_lint_results_hash_lookup 
ON lint_results (content_hash, linter_type, options_hash);

CREATE INDEX IF NOT EXISTS idx_lint_results_expires 
ON lint_results (expires_at);

CREATE INDEX IF NOT EXISTS idx_lint_results_created 
ON lint_results (created_at);

-- Async job tracking table  
CREATE TABLE IF NOT EXISTS lint_jobs (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    linter_type TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('json', 'text', 'sarif')),
    options TEXT NOT NULL, -- JSON string of options
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    result TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

-- Indexes for lint_jobs
CREATE INDEX IF NOT EXISTS idx_lint_jobs_status 
ON lint_jobs (status);

CREATE INDEX IF NOT EXISTS idx_lint_jobs_created 
ON lint_jobs (created_at);

CREATE INDEX IF NOT EXISTS idx_lint_jobs_hash 
ON lint_jobs (content_hash);

-- API metrics and monitoring
CREATE TABLE IF NOT EXISTS api_metrics (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS')),
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    linter_type TEXT,
    format TEXT,
    error_type TEXT, -- categorized error types for monitoring
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for api_metrics
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint 
ON api_metrics (endpoint, method);

CREATE INDEX IF NOT EXISTS idx_api_metrics_created 
ON api_metrics (created_at);

CREATE INDEX IF NOT EXISTS idx_api_metrics_status 
ON api_metrics (status_code);

CREATE INDEX IF NOT EXISTS idx_api_metrics_cache 
ON api_metrics (cache_hit);

-- Views for common queries
CREATE VIEW IF NOT EXISTS cache_stats AS
SELECT 
    COUNT(*) as total_cached,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_cached,
    COUNT(CASE WHEN expires_at > datetime('now') THEN 1 END) as valid_cached,
    linter_type,
    format
FROM lint_results 
GROUP BY linter_type, format;

CREATE VIEW IF NOT EXISTS job_stats AS  
SELECT 
    status,
    COUNT(*) as count,
    linter_type,
    AVG(
        CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at)) * 86400000
        END
    ) as avg_duration_ms
FROM lint_jobs
GROUP BY status, linter_type;

CREATE VIEW IF NOT EXISTS recent_metrics AS
SELECT 
    endpoint,
    method,
    COUNT(*) as request_count,
    AVG(response_time_ms) as avg_response_time,
    COUNT(CASE WHEN cache_hit = TRUE THEN 1 END) * 100.0 / COUNT(*) as cache_hit_rate,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*) as error_rate
FROM api_metrics 
WHERE created_at >= datetime('now', '-1 hour')
GROUP BY endpoint, method;

-- Cleanup trigger to remove expired cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
    AFTER INSERT ON lint_results
BEGIN
    DELETE FROM lint_results 
    WHERE expires_at <= datetime('now');
END;