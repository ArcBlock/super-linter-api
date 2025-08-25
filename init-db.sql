-- Initialize database tables for Super Linter API

-- Cache table
CREATE TABLE IF NOT EXISTS lint_results (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  linter_type TEXT NOT NULL,
  options_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Jobs table  
CREATE TABLE IF NOT EXISTS lint_jobs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  linter_type TEXT NOT NULL,
  format TEXT NOT NULL,
  content TEXT,
  archive TEXT,
  filename TEXT,
  options TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

-- Metrics table
CREATE TABLE IF NOT EXISTS api_metrics (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  linter_type TEXT,
  format TEXT,
  error_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lint_results_hash ON lint_results(content_hash, linter_type, options_hash);
CREATE INDEX IF NOT EXISTS idx_lint_results_expires ON lint_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_lint_jobs_status ON lint_jobs(status);
CREATE INDEX IF NOT EXISTS idx_lint_jobs_created ON lint_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_metrics_created ON api_metrics(created_at);