export interface LintResult {
  id: string;
  content_hash: string;
  linter_type: string;
  options_hash: string;
  result: string;
  format: string;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  created_at: string;
  expires_at: string;
}

export interface LintJob {
  id: string;
  content_hash: string;
  linter_type: string;
  format: string;
  options: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ApiMetric {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  cache_hit: boolean;
  linter_type?: string;
  format?: string;
  error_type?: string;
  created_at: string;
}

export interface DatabaseSchema {
  lint_results: LintResult;
  lint_jobs: LintJob;
  api_metrics: ApiMetric;
}