import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { WorkspaceManager } from './workspace';
import { LinterRunner } from './linter';
import { CacheService } from './cache';
import { LinterType, OutputFormat, LinterOptions } from '../types/api';
import { LintJob, JobStatus } from '../types/database';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export interface JobResult {
  job_id: string;
  status: JobStatus;
  result?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  execution_time_ms?: number;
}

export interface JobRequest {
  linter: LinterType;
  format: OutputFormat;
  options: LinterOptions;
  content?: string;
  archive?: string;
  filename?: string;
  requestId?: string;
}

export class JobManager extends EventEmitter {
  private db: DatabaseService;
  private workspaceManager: WorkspaceManager;
  private linterRunner: LinterRunner;
  private cacheService: CacheService;
  private runningJobs: Map<string, AbortController>;
  private jobTimeouts: Map<string, NodeJS.Timeout>;
  private maxConcurrentJobs: number;
  private jobTimeoutMs: number;

  constructor(
    db: DatabaseService,
    workspaceManager: WorkspaceManager,
    linterRunner: LinterRunner,
    cacheService: CacheService,
    options: {
      maxConcurrentJobs?: number;
      jobTimeoutMs?: number;
    } = {}
  ) {
    super();
    this.db = db;
    this.workspaceManager = workspaceManager;
    this.linterRunner = linterRunner;
    this.cacheService = cacheService;
    this.runningJobs = new Map();
    this.jobTimeouts = new Map();
    this.maxConcurrentJobs = options.maxConcurrentJobs || 10;
    this.jobTimeoutMs = options.jobTimeoutMs || 300000; // 5 minutes default

    // Cleanup on process exit
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  async submitJob(request: JobRequest): Promise<string> {
    try {
      // Generate job ID
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check concurrent job limit
      if (this.runningJobs.size >= this.maxConcurrentJobs) {
        throw new Error(`Maximum concurrent jobs limit reached (${this.maxConcurrentJobs})`);
      }

      // Create job record
      const job: Omit<LintJob, 'id'> = {
        job_id: jobId,
        linter_type: request.linter,
        format: request.format,
        status: 'pending' as JobStatus,
        options: JSON.stringify(request.options),
        created_at: new Date().toISOString(),
        ...(request.content && { content: request.content }),
        ...(request.archive && { archive: request.archive }),
        ...(request.filename && { filename: request.filename }),
      };

      await this.db.createJob(job);

      logger.info('Job submitted', {
        jobId,
        linter: request.linter,
        format: request.format,
        requestId: request.requestId,
      });

      // Start processing the job asynchronously
      this.processJob(jobId, request).catch(error => {
        logger.error('Job processing failed', {
          jobId,
          error: error.message,
        });
      });

      return jobId;

    } catch (error: any) {
      logger.error('Failed to submit job', {
        error: error.message,
        linter: request.linter,
        format: request.format,
      });
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<JobResult | null> {
    try {
      const job = await this.db.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        job_id: job.job_id,
        status: job.status,
        result: job.result ? JSON.parse(job.result) : undefined,
        ...(job.error_message && { error: job.error_message }),
        created_at: job.created_at,
        ...(job.started_at && { started_at: job.started_at }),
        ...(job.completed_at && { completed_at: job.completed_at }),
        ...(job.execution_time_ms && { execution_time_ms: job.execution_time_ms }),
      };
    } catch (error: any) {
      logger.error('Failed to get job status', {
        jobId,
        error: error.message,
      });
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.db.getJob(jobId);
      if (!job) {
        return false;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return false; // Cannot cancel completed jobs
      }

      // Cancel running job
      const abortController = this.runningJobs.get(jobId);
      if (abortController) {
        abortController.abort();
        this.runningJobs.delete(jobId);
      }

      // Clear timeout
      const timeout = this.jobTimeouts.get(jobId);
      if (timeout) {
        clearTimeout(timeout);
        this.jobTimeouts.delete(jobId);
      }

      // Update job status
      await this.db.updateJobStatus(jobId, 'cancelled', undefined, 'Job cancelled by user');

      logger.info('Job cancelled', { jobId });
      this.emit('jobCancelled', jobId);

      return true;
    } catch (error: any) {
      logger.error('Failed to cancel job', {
        jobId,
        error: error.message,
      });
      return false;
    }
  }

  private async processJob(jobId: string, request: JobRequest): Promise<void> {
    const abortController = new AbortController();
    this.runningJobs.set(jobId, abortController);

    // Set up job timeout
    const timeout = setTimeout(() => {
      this.handleJobTimeout(jobId);
    }, this.jobTimeoutMs);
    this.jobTimeouts.set(jobId, timeout);

    try {
      // Update job status to running
      await this.db.updateJobStatus(jobId, 'running');
      
      const startTime = Date.now();
      logger.info('Job processing started', { jobId });

      // Check cache first
      let contentHash: string;
      if (request.content) {
        contentHash = this.cacheService.generateContentHash(request.content);
      } else if (request.archive) {
        contentHash = this.cacheService.generateContentHash(request.archive);
      } else {
        throw new Error('No content or archive provided');
      }

      const optionsHash = this.cacheService.generateOptionsHash(request.options);
      const cachedResult = await this.cacheService.get(contentHash, request.linter, optionsHash);

      let result: any;
      
      if (cachedResult) {
        logger.info('Cache hit for job', {
          jobId,
          linter: request.linter,
          contentHash: contentHash.substring(0, 8),
        });
        result = cachedResult;
      } else {
        // Create workspace
        let workspace;
        if (request.content) {
          const filename = request.filename || this.getDefaultFilename(request.linter);
          workspace = await this.workspaceManager.createWorkspaceFromText(request.content, filename);
        } else if (request.archive) {
          workspace = await this.workspaceManager.createWorkspaceFromBase64(request.archive);
        } else {
          throw new Error('No content provided');
        }

        try {
          // Check if job was aborted
          if (abortController.signal.aborted) {
            throw new Error('Job was cancelled');
          }

          // Run linter
          result = await this.linterRunner.runLinter({
            linter: request.linter,
            workspace_path: workspace.path,
            options: request.options,
            timeout_ms: request.options.timeout || 30000,
          });

          // Cache the result
          await this.cacheService.set(
            contentHash,
            request.linter,
            request.format,
            optionsHash,
            result,
            result.success ? 'success' : 'error'
          );

        } finally {
          // Cleanup workspace
          await this.workspaceManager.cleanupWorkspace(workspace.path).catch(err => {
            logger.warn('Failed to cleanup workspace for job', {
              jobId,
              workspacePath: workspace.path,
              error: err.message,
            });
          });
        }
      }

      // Check if job was aborted during processing
      if (abortController.signal.aborted) {
        return; // Job was cancelled
      }

      const executionTime = Date.now() - startTime;

      // Update job with result
      await this.db.updateJobStatus(
        jobId, 
        'completed', 
        JSON.stringify(result),
        undefined,
        executionTime
      );

      logger.info('Job completed successfully', {
        jobId,
        executionTime,
        success: result.success,
      });

      this.emit('jobCompleted', jobId, result);

    } catch (error: any) {
      const executionTime = Date.now() - Date.now(); // This will be small for errors

      logger.error('Job failed', {
        jobId,
        error: error.message,
        stack: error.stack,
      });

      if (!abortController.signal.aborted) {
        await this.db.updateJobStatus(
          jobId,
          'failed',
          undefined,
          error.message,
          executionTime
        );

        this.emit('jobFailed', jobId, error.message);
      }

    } finally {
      // Cleanup
      this.runningJobs.delete(jobId);
      clearTimeout(timeout);
      this.jobTimeouts.delete(jobId);
    }
  }

  private async handleJobTimeout(jobId: string): Promise<void> {
    logger.warn('Job timed out', { jobId });

    const abortController = this.runningJobs.get(jobId);
    if (abortController) {
      abortController.abort();
      this.runningJobs.delete(jobId);
    }

    await this.db.updateJobStatus(
      jobId,
      'failed',
      undefined,
      `Job timed out after ${this.jobTimeoutMs}ms`,
      this.jobTimeoutMs
    );

    this.emit('jobTimeout', jobId);
  }

  private getDefaultFilename(linter: LinterType): string {
    switch (linter) {
      case 'eslint':
        return 'code.js';
      case 'pylint':
      case 'black':
      case 'flake8':
        return 'code.py';
      case 'rubocop':
        return 'code.rb';
      case 'shellcheck':
        return 'code.sh';
      case 'phpstan':
        return 'code.php';
      case 'golangci-lint':
        return 'code.go';
      case 'ktlint':
        return 'code.kt';
      case 'swiftlint':
        return 'code.swift';
      default:
        return 'code.txt';
    }
  }

  async getJobStats(): Promise<{
    running: number;
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    try {
      const stats = await this.db.getJobStats();
      return {
        running: this.runningJobs.size,
        pending: stats.find(s => s.status === 'pending')?.count || 0,
        completed: stats.find(s => s.status === 'completed')?.count || 0,
        failed: stats.find(s => s.status === 'failed')?.count || 0,
        cancelled: stats.find(s => s.status === 'cancelled')?.count || 0,
      };
    } catch (error: any) {
      logger.error('Failed to get job stats', { error: error.message });
      throw error;
    }
  }

  async getRunningJobs(): Promise<string[]> {
    return Array.from(this.runningJobs.keys());
  }

  private cleanup(): void {
    logger.info(`Cleaning up ${this.runningJobs.size} running jobs`);
    
    // Cancel all running jobs
    for (const [jobId, abortController] of this.runningJobs.entries()) {
      try {
        abortController.abort();
      } catch (error: any) {
        logger.warn(`Failed to abort job ${jobId}: ${error.message}`);
      }
    }

    // Clear all timeouts
    for (const timeout of this.jobTimeouts.values()) {
      clearTimeout(timeout);
    }

    this.runningJobs.clear();
    this.jobTimeouts.clear();
  }
}