export type LinterType =
  | 'eslint'
  | 'oxlint'
  | 'biome'
  | 'biome-lint'
  | 'prettier'
  | 'jshint'
  | 'pylint'
  | 'flake8'
  | 'black'
  | 'isort'
  | 'bandit'
  | 'mypy'
  | 'shellcheck'
  | 'golangci-lint'
  | 'gofmt'
  | 'rubocop'
  | 'hadolint'
  | 'yamllint'
  | 'jsonlint'
  | 'markdownlint'
  | 'stylelint';

export type OutputFormat = 'json' | 'text' | 'sarif';

export interface LinterOptions {
  validate_all?: boolean;
  exclude_patterns?: string[];
  include_patterns?: string[];
  log_level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  timeout?: number;
  fix?: boolean;
  config_file?: string;
  rules?: Record<string, any>;
}

export interface LintRequest {
  content: string | Buffer;
  options?: LinterOptions;
}

export interface EncodedLintRequest {
  encoded_content: string;
  options?: LinterOptions;
}

export interface LintResponse {
  success: boolean;
  linter_type: LinterType;
  format: OutputFormat;
  result: any;
  metadata: {
    execution_time_ms: number;
    cache_hit: boolean;
    file_count?: number;
    issues_count?: number;
    warnings_count?: number;
    errors_count?: number;
    timestamp: string;
  };
  error?: string;
}

export interface AsyncLintResponse {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  linter_type: LinterType;
  format: OutputFormat;
  created_at: string;
  estimated_completion?: string;
}

export interface JobStatusResponse extends AsyncLintResponse {
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    completed_files: number;
    total_files: number;
    percentage: number;
  };
}

export interface LinterInfo {
  name: LinterType;
  display_name: string;
  description: string;
  supported_formats: OutputFormat[];
  supported_languages: string[];
  default_options: LinterOptions;
  version?: string;
  available: boolean;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_ms: number;
  database: {
    status: 'healthy' | 'unhealthy';
    cache_entries: number;
    pending_jobs: number;
  };
  linters: {
    available: number;
    total: number;
    failing: string[];
  };
  metrics: {
    requests_last_hour: number;
    cache_hit_rate: number;
    avg_response_time_ms: number;
    error_rate: number;
  };
}

export interface MetricsResponse {
  cache: {
    total_entries: number;
    hit_rate_percentage: number;
    size_mb: number;
    expired_entries: number;
  };
  jobs: {
    pending: number;
    running: number;
    completed_last_24h: number;
    failed_last_24h: number;
    avg_execution_time_ms: number;
  };
  api: {
    requests_per_hour: number;
    requests_per_day: number;
    avg_response_time_ms: number;
    error_rate_percentage: number;
    top_endpoints: Array<{
      endpoint: string;
      requests: number;
      avg_response_time_ms: number;
    }>;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    request_id?: string;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    filesystem: boolean;
    linters: boolean;
  };
  uptime_ms: number;
}
