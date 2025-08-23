import { execSync } from 'child_process';
import { join } from 'path';
import { LintResult, LintJob, ApiMetric } from '../types/database';

export class DatabaseService {
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(__dirname, '..', '..', 'data', 'super-linter-api.db');
  }

  private query(sql: string, params: any[] = []): any[] {
    try {
      const paramStr = params.length > 0 ? ` -cmd ".param ${params.map((p, i) => `set $${i+1} '${p}'`).join(' ')}"` : '';
      const result = execSync(`sqlite3${paramStr} "${this.dbPath}" "${sql}"`, { 
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
    
    this.exec(`
      INSERT INTO lint_results (
        id, content_hash, linter_type, options_hash, 
        result, format, status, error_message, expires_at
      ) VALUES (
        '${id}', '${result.content_hash}', '${result.linter_type}', '${result.options_hash}',
        '${result.result.replace(/'/g, "''")}', '${result.format}', '${result.status}', 
        ${result.error_message ? `'${result.error_message.replace(/'/g, "''")}'` : 'NULL'}, 
        '${result.expires_at}'
      );
    `);
    
    return id;
  }

  // Job operations
  async createJob(job: Omit<LintJob, 'id' | 'created_at'>): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.exec(`
      INSERT INTO lint_jobs (
        id, content_hash, linter_type, format, options, status
      ) VALUES (
        '${id}', '${job.content_hash}', '${job.linter_type}', '${job.format}',
        '${job.options.replace(/'/g, "''")}', '${job.status}'
      );
    `);
    
    return id;
  }

  async getJob(id: string): Promise<LintJob | null> {
    const sql = `
      SELECT json_object(
        'id', id,
        'content_hash', content_hash,
        'linter_type', linter_type,
        'format', format,
        'options', options,
        'status', status,
        'result', result,
        'error_message', error_message,
        'created_at', created_at,
        'started_at', started_at,
        'completed_at', completed_at
      ) as json_result
      FROM lint_jobs WHERE id = ? LIMIT 1;
    `;
    
    const results = this.query(sql, [id]);
    if (results.length === 0) return null;
    
    return JSON.parse(results[0].json_result);
  }

  async updateJobStatus(id: string, status: LintJob['status'], result?: string, errorMessage?: string): Promise<void> {
    const now = new Date().toISOString();
    let sql = `UPDATE lint_jobs SET status = '${status}'`;
    
    if (status === 'running') {
      sql += `, started_at = '${now}'`;
    } else if (status === 'completed' || status === 'failed') {
      sql += `, completed_at = '${now}'`;
    }
    
    if (result) {
      sql += `, result = '${result.replace(/'/g, "''")}'`;
    }
    
    if (errorMessage) {
      sql += `, error_message = '${errorMessage.replace(/'/g, "''")}'`;
    }
    
    sql += ` WHERE id = '${id}';`;
    
    this.exec(sql);
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
    
    this.exec(`
      INSERT INTO api_metrics (
        id, endpoint, method, status_code, response_time_ms, 
        cache_hit, linter_type, format, error_type
      ) VALUES (
        '${id}', '${metric.endpoint}', '${metric.method}', ${metric.status_code}, 
        ${metric.response_time_ms}, ${metric.cache_hit ? 1 : 0},
        ${metric.linter_type ? `'${metric.linter_type}'` : 'NULL'},
        ${metric.format ? `'${metric.format}'` : 'NULL'},
        ${metric.error_type ? `'${metric.error_type}'` : 'NULL'}
      );
    `);
  }

  // Statistics queries
  async getCacheStats(): Promise<any> {
    const sql = 'SELECT * FROM cache_stats;';
    return this.query(sql);
  }

  async getJobStats(): Promise<any> {
    const sql = 'SELECT * FROM job_stats;';
    return this.query(sql);
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