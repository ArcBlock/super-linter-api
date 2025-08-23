import { execSync } from 'child_process';
import { join } from 'path';
import { LintResult, LintJob, ApiMetric, JobStatus } from '../types/database';

export class DatabaseService {
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(__dirname, '..', '..', 'data', 'super-linter-api.db');
  }

  private query(sql: string, params: any[] = []): any[] {
    try {
      // For complex JSON queries, we need to be very careful with escaping
      let processedSql = sql;
      
      // Replace ? placeholders with properly escaped parameters
      params.forEach((param) => {
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
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      if (!result.trim()) return [];
      
      return result.trim().split('\n').map(row => {
        try {
          return JSON.parse(row);
        } catch {
          return row.split('|');
        }
      });
    } catch (error: any) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  private exec(sql: string): void {
    try {
      execSync(`sqlite3 "${this.dbPath}" "${sql}"`, { 
        encoding: 'utf-8' 
      });
    } catch (error) {
      console.error('Database exec failed:', error);
      throw error;
    }
  }

  // Cache operations
  async getCachedResult(contentHash: string, linterType: string, optionsHash: string): Promise<LintResult | null> {
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
    
    return JSON.parse(results[0].json_result);
  }

  async storeCachedResult(result: Omit<LintResult, 'id'>): Promise<string> {
    const id = `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO lint_results (
        id, content_hash, linter_type, options_hash, 
        result, format, status, error_message, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    
    this.query(sql, [
      id,
      result.content_hash,
      result.linter_type,
      result.options_hash,
      result.result,
      result.format,
      result.status,
      result.error_message,
      result.expires_at
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
      job.created_at
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
    
    return JSON.parse(results[0].json_result);
  }

  async updateJobStatus(jobId: string, status: JobStatus, result?: string, errorMessage?: string, executionTimeMs?: number): Promise<void> {
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
        'content_hash', content_hash,
        'linter_type', linter_type,
        'format', format,
        'options', options,
        'status', status,
        'created_at', created_at
      ) as json_result
      FROM lint_jobs 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT ${limit};
    `;
    
    const results = this.query(sql);
    return results.map(row => JSON.parse(row.json_result));
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
      metric.error_type
    ]);
  }

  // Statistics queries
  async getCacheStats(): Promise<any> {
    const sql = 'SELECT * FROM cache_stats;';
    return this.query(sql);
  }

  async getJobStats(): Promise<Array<{status: string, count: number}>> {
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
    this.exec(`DELETE FROM lint_results WHERE expires_at <= datetime('now');`);
    
    // Return count of deleted records
    const queryResult = this.query(`SELECT changes() as deleted;`);
    return queryResult[0]?.deleted || 0;
  }

  async cleanupOldJobs(olderThanDays = 7): Promise<number> {
    this.exec(`
      DELETE FROM lint_jobs 
      WHERE status IN ('completed', 'failed', 'cancelled') 
        AND created_at <= datetime('now', '-${olderThanDays} days');
    `);
    
    const queryResult = this.query(`SELECT changes() as deleted;`);
    return queryResult[0]?.deleted || 0;
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', details: any }> {
    try {
      const result = this.query('SELECT 1 as test;');
      const tableCount = this.query(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%';
      `);
      
      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          tables: tableCount[0]?.count || 0,
          dbPath: this.dbPath
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message, dbPath: this.dbPath }
      };
    }
  }
}