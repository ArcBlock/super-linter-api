import { execSync } from 'child_process';
import { join } from 'path';
import { LintResult, LintJob, ApiMetric, JobStatus } from '../types/database';

export class DatabaseService {
  private dbPath: string;

  private toSqlDateTime(dt: string): string {
    try {
      // Normalize to 'YYYY-MM-DD HH:MM:SS' for proper SQLite comparison
      const d = new Date(dt);
      if (!isNaN(d.getTime())) {
        // Use UTC to match SQLite datetime('now') which is UTC by default
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = d.getUTCFullYear();
        const month = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        const hours = pad(d.getUTCHours());
        const minutes = pad(d.getUTCMinutes());
        const seconds = pad(d.getUTCSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
    } catch {
      // ignore
    }
    // Fallback: best-effort normalization
    return dt.replace('T', ' ').replace('Z', '').replace(/\.\d+/, '');
  }

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(__dirname, '..', '..', 'data', 'super-linter-api.db');
  }

  async initialize(): Promise<void> {
    const { execSync } = require('child_process');
    const { existsSync, mkdirSync } = require('fs');
    const { dirname } = require('path');

    try {
      // Ensure directory exists
      const dataDir = dirname(this.dbPath);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      // Use the schema from scripts folder
      const schemaPath = join(__dirname, '..', '..', 'scripts', 'schema.sql');
      execSync(`sqlite3 "${this.dbPath}" < "${schemaPath}"`, { stdio: 'pipe' });
    } catch {
      // If schema file doesn't exist, create basic tables
      this.exec(`
        CREATE TABLE IF NOT EXISTS lint_results (
          id TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          linter_type TEXT NOT NULL,
          options_hash TEXT NOT NULL,
          result TEXT,
          format TEXT NOT NULL,
          status TEXT NOT NULL,
          error_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lint_jobs (
          id TEXT PRIMARY KEY,
          job_id TEXT UNIQUE NOT NULL,
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          started_at TEXT,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS api_metrics (
          id TEXT PRIMARY KEY,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_time_ms INTEGER NOT NULL,
          cache_hit INTEGER DEFAULT 0,
          linter_type TEXT,
          format TEXT,
          error_type TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  private query(sql: string, params: any[] = []): any[] {
    // For complex JSON queries, we need to be very careful with escaping
    let processedSql = sql;

    // Replace ? placeholders with properly escaped parameters
    params.forEach(param => {
      const placeholder = '?';
      if (processedSql.includes(placeholder)) {
        let escapedParam: string;

        if (param === null || param === undefined) {
          escapedParam = 'NULL';
        } else if (typeof param === 'string') {
          // For SQLite command line, we need to escape very carefully
          // Replace single quotes with double single quotes, handle special chars
          const escaped = param
            .replace(/'/g, "''")
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"')
            .replace(/\x00/g, '\\0');
          escapedParam = `'${escaped}'`;
        } else if (typeof param === 'number') {
          escapedParam = param.toString();
        } else if (typeof param === 'boolean') {
          escapedParam = param ? '1' : '0';
        } else {
          // For objects, stringify and escape
          const jsonStr = JSON.stringify(param);
          const escaped = jsonStr
            .replace(/'/g, "''")
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"')
            .replace(/\x00/g, '\\0');
          escapedParam = `'${escaped}'`;
        }

        processedSql = processedSql.replace(placeholder, escapedParam);
      }
    });

    const result = execSync(`sqlite3 "${this.dbPath}" "${processedSql}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (!result.trim()) return [];

    return result
      .trim()
      .split('\n')
      .map(row => {
        try {
          return JSON.parse(row);
        } catch {
          return row.split('|');
        }
      });
  }

  private exec(sql: string): void {
    execSync(`sqlite3 "${this.dbPath}" "${sql}"`, {
      encoding: 'utf-8',
    });
  }

  // Helper to perform a write (e.g., DELETE) and return number of changed rows
  private deleteAndReturnChanges(deleteSql: string, params: any[] = []): number {
    // Execute the DELETE followed by a SELECT of changes() within the same sqlite3 invocation
    const combinedSql = `${deleteSql}; SELECT json_object('deleted', changes())`;
    const result = this.query(combinedSql, params);
    const first = result[0] as any;
    if (first && typeof first === 'object' && 'deleted' in first) {
      const n = parseInt((first as any).deleted as any, 10);
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  }

  // Cache operations
  async getCachedResult(
    contentHash: string,
    linterType: string,
    optionsHash: string
  ): Promise<LintResult | null> {
    const sql = `
      SELECT json_object(
        'id', id,
        'content_hash', content_hash,
        'linter_type', linter_type,
        'options_hash', options_hash,
        'result', result,
        'format', format,
        'status', status,
        'error_message', error_message,
        'created_at', created_at,
        'expires_at', expires_at
      ) as json_result
      FROM lint_results
      WHERE content_hash = ? AND linter_type = ? AND options_hash = ?
        AND expires_at > datetime('now')
      LIMIT 1;
    `;

    const results = this.query(sql, [contentHash, linterType, optionsHash]);
    if (results.length === 0) return null;
    const row = results[0] as any;
    // Normalize datetime fields back to ISO for JS correctness
    const normalize = (dt?: string) => (dt ? dt.replace(' ', 'T') + 'Z' : dt);
    row.created_at = normalize(row.created_at);
    row.expires_at = normalize(row.expires_at);
    return row as LintResult;
  }

  async storeCachedResult(result: Omit<LintResult, 'id'>): Promise<string> {
    const id = `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO lint_results (
        id, content_hash, linter_type, options_hash,
        result, format, status, error_message, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const expiresAt = this.toSqlDateTime(result.expires_at);

    this.query(sql, [
      id,
      result.content_hash,
      result.linter_type,
      result.options_hash,
      result.result,
      result.format,
      result.status,
      result.error_message,
      expiresAt,
    ]);

    return id;
  }

  // Job operations
  async createJob(job: Omit<LintJob, 'id'>): Promise<string> {
    const id = `${job.job_id}`;

    // Use parameterized INSERT
    const sql = `
      INSERT INTO lint_jobs (
        id, job_id, linter_type, format, content, archive, filename, options, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      id,
      job.job_id,
      job.linter_type,
      job.format,
      job.content || null,
      job.archive || null,
      job.filename || null,
      job.options,
      job.status,
      job.created_at,
    ];

    this.query(sql, params);

    return id;
  }

  async getJob(jobId: string): Promise<LintJob | null> {
    const sql = `
      SELECT json_object(
        'id', id,
        'job_id', job_id,
        'linter_type', linter_type,
        'format', format,
        'content', content,
        'archive', archive,
        'filename', filename,
        'options', options,
        'status', status,
        'result', result,
        'error_message', error_message,
        'execution_time_ms', execution_time_ms,
        'created_at', created_at,
        'started_at', started_at,
        'completed_at', completed_at
      ) as json_result
      FROM lint_jobs WHERE job_id = ? LIMIT 1;
    `;

    const results = this.query(sql, [jobId]);
    if (results.length === 0) return null;
    return results[0];
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    result?: string,
    errorMessage?: string,
    executionTimeMs?: number
  ): Promise<void> {
    const now = new Date().toISOString();

    // Build the SET clause parts
    const setParts = ['status = ?'];
    const params: any[] = [status];

    if (status === 'running') {
      setParts.push('started_at = ?');
      params.push(now);
    } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setParts.push('completed_at = ?');
      params.push(now);
    }

    if (result) {
      setParts.push('result = ?');
      params.push(result);
    }

    if (errorMessage) {
      setParts.push('error_message = ?');
      params.push(errorMessage);
    }

    if (executionTimeMs !== undefined) {
      setParts.push('execution_time_ms = ?');
      params.push(executionTimeMs);
    }

    const sql = `UPDATE lint_jobs SET ${setParts.join(', ')} WHERE job_id = ?;`;
    params.push(jobId);

    this.query(sql, params);
  }

  async getPendingJobs(limit = 10): Promise<LintJob[]> {
    const sql = `
      SELECT json_object(
        'id', id,
        'job_id', job_id,
        'linter_type', linter_type,
        'format', format,
        'content', content,
        'archive', archive,
        'filename', filename,
        'options', options,
        'status', status,
        'result', result,
        'error_message', error_message,
        'execution_time_ms', execution_time_ms,
        'created_at', created_at,
        'started_at', started_at,
        'completed_at', completed_at
      ) as json_result
      FROM lint_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit};
    `;

    const results = this.query(sql);
    return results as any;
  }

  // Metrics operations
  async recordMetric(metric: Omit<ApiMetric, 'id' | 'created_at'>): Promise<void> {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO api_metrics (
        id, endpoint, method, status_code, response_time_ms,
        cache_hit, linter_type, format, error_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    this.query(sql, [
      id,
      metric.endpoint,
      metric.method,
      metric.status_code,
      metric.response_time_ms,
      metric.cache_hit ? 1 : 0,
      metric.linter_type,
      metric.format,
      metric.error_type,
    ]);
  }

  // Statistics queries
  async getCacheStats(): Promise<any> {
    const sql = 'SELECT * FROM cache_stats;';
    return this.query(sql);
  }

  async getJobStats(): Promise<Array<{ status: string; count: number }>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM lint_jobs
      GROUP BY status;
    `;
    const results = this.query(sql);
    return results.map((row: any) => ({ status: row[0], count: parseInt(row[1]) }));
  }

  async getRecentMetrics(): Promise<any> {
    const sql = 'SELECT * FROM recent_metrics;';
    return this.query(sql);
  }

  // Cleanup operations
  async cleanupExpiredCache(): Promise<number> {
    // Delete expired cache and return number of rows affected
    return this.deleteAndReturnChanges(
      `DELETE FROM lint_results WHERE expires_at <= datetime('now')`
    );
  }

  async cleanupOldJobs(olderThanDays = 7): Promise<number> {
    return this.deleteAndReturnChanges(`
      DELETE FROM lint_jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND created_at <= datetime('now', '-${olderThanDays} days')
    `);
  }

  // Cache invalidation operations
  async clearAllCache(): Promise<number> {
    return this.deleteAndReturnChanges(`DELETE FROM lint_results`);
  }

  async clearCacheByContent(contentHash: string): Promise<number> {
    return this.deleteAndReturnChanges(`DELETE FROM lint_results WHERE content_hash = ?`, [
      contentHash,
    ]);
  }

  async clearCacheByLinter(linterType: string): Promise<number> {
    return this.deleteAndReturnChanges(`DELETE FROM lint_results WHERE linter_type = ?`, [
      linterType,
    ]);
  }

  async clearCacheByContentAndLinter(contentHash: string, linterType: string): Promise<number> {
    return this.deleteAndReturnChanges(
      `DELETE FROM lint_results WHERE content_hash = ? AND linter_type = ?`,
      [contentHash, linterType]
    );
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      this.query('SELECT 1 as test;');
      const tableCount = this.query(`
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%';
      `);

      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          tables: tableCount[0]?.count || 0,
          dbPath: this.dbPath,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message, dbPath: this.dbPath },
      };
    }
  }
}
