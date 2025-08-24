import { Router, Request, Response, NextFunction } from 'express';
import { LinterType, OutputFormat, LinterOptions } from '../types/api';
import { createErrorResponse } from '../types/errors';
import { WorkspaceManager } from '../services/workspace';
import { LinterRunner } from '../services/linter';
import { CacheService } from '../services/cache';
import { DatabaseService } from '../services/database';
import { JobManager } from '../services/jobManager';
import { inflateRaw } from 'zlib';
import { promisify } from 'util';
import winston from 'winston';
import { z, ZodError } from 'zod';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const inflateAsync = promisify(inflateRaw);

// Validation schemas
const LinterParamSchema = z.enum([
  'eslint', 'pylint', 'rubocop', 'shellcheck', 'black', 'flake8', 
  'phpstan', 'golangci-lint', 'ktlint', 'swiftlint'
]);

const FormatParamSchema = z.enum(['json', 'text', 'sarif']);

const QueryOptionsSchema = z.object({
  validate_all: z.string().optional().transform(val => val === 'true'),
  exclude_patterns: z.string().optional().transform(val => val ? val.split(',') : undefined),
  include_patterns: z.string().optional().transform(val => val ? val.split(',') : undefined),
  log_level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
  timeout: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  fix: z.string().optional().transform(val => val === 'true'),
  config_file: z.string().optional(),
});

const PostBodySchema = z.object({
  content: z.string().optional(),
  archive: z.string().optional(), // base64 encoded tar.gz
  filename: z.string().optional(),
  options: z.object({
    validate_all: z.boolean().default(false),
    exclude_patterns: z.array(z.string()).default([]),
    include_patterns: z.array(z.string()).default([]),
    log_level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
    timeout: z.number().default(30000),
    fix: z.boolean().default(false),
    config_file: z.string().optional(),
    rules: z.record(z.string(), z.any()).default({}),
  }).default({
    validate_all: false,
    exclude_patterns: [],
    include_patterns: [],
    log_level: 'INFO',
    timeout: 30000,
    fix: false,
    rules: {},
  }),
}).refine(data => data.content || data.archive, {
  message: "Either 'content' or 'archive' must be provided",
});

export function createLinterRouter(
  workspaceManager: WorkspaceManager,
  linterRunner: LinterRunner,
  cacheService: CacheService,
  db: DatabaseService,
  jobManager: JobManager
): Router {
  const router = Router();

  // Validation middleware for linter and format params
  const validateParams = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const linter = LinterParamSchema.parse(req.params.linter);
      const format = FormatParamSchema.parse(req.params.format);
      
      (req as any).validatedParams = { linter, format };
      next();
    } catch (error: any) {
      const requestId = (req as any).requestId;
      const errorResponse = createErrorResponse({
        code: 'INVALID_PARAMETERS',
        message: `Invalid linter or format parameter: ${error.message}`,
        statusCode: 400,
        name: 'ValidationError',
      }, requestId);
      res.status(400).json(errorResponse);
    }
  };

  // GET /{linter}/{format}/{encoded} - Kroki-style endpoint
  router.get('/:linter/:format/:encoded', validateParams, async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    const { linter, format } = (req as any).validatedParams;
    const { encoded } = req.params;
    
    if (!encoded) {
      const errorResponse = createErrorResponse({
        code: 'INVALID_PARAMETERS',
        message: 'Encoded content parameter is required',
        statusCode: 400,
        name: 'ValidationError',
      }, requestId);
      res.status(400).json(errorResponse);
      return;
    }
    
    try {
      logger.info('Processing Kroki-style GET request', {
        requestId,
        linter,
        format,
        encodedLength: encoded.length,
      });

      // Parse query options
      const queryOptions = QueryOptionsSchema.parse(req.query);
      const options: LinterOptions = {
        validate_all: queryOptions.validate_all || false,
        exclude_patterns: queryOptions.exclude_patterns || [],
        include_patterns: queryOptions.include_patterns || [],
        log_level: queryOptions.log_level || 'INFO',
        timeout: queryOptions.timeout || 30000,
        fix: queryOptions.fix || false,
        ...(queryOptions.config_file && { config_file: queryOptions.config_file }),
        rules: {},
      };

      // Store for metrics
      (req as any).linterType = linter;
      (req as any).format = format;

      // Decode content (deflate + base64)
      let content: string;
      try {
        const compressed = Buffer.from(encoded, 'base64');
        const inflated = await inflateAsync(compressed);
        content = inflated.toString('utf-8');
      } catch (decodeError: any) {
        logger.warn('Failed to decode content', {
          requestId,
          error: decodeError.message,
          encodedLength: encoded?.length || 0,
        });
        
        const errorResponse = createErrorResponse({
          code: 'INVALID_CONTENT_ENCODING',
          message: 'Failed to decode content. Expected deflate+base64 encoded data.',
          statusCode: 400,
          name: 'DecodingError',
        }, requestId);
        res.status(400).json(errorResponse);
        return;
      }

      // Generate cache keys
      const contentHash = cacheService.generateContentHash(content);
      const optionsHash = cacheService.generateOptionsHash(options);

      // Check cache first
      const cachedResult = await cacheService.get(contentHash, linter, optionsHash);
      if (cachedResult) {
        logger.info('Cache hit for GET request', {
          requestId,
          linter,
          contentHash: contentHash.substring(0, 8),
        });
        
        (req as any).cacheHit = true;
        const parsed = safeParseCachedResult(cachedResult);
        res.json(formatLinterResult(parsed, format));
        return;
      }

      // Create workspace and run linter
      const workspace = await workspaceManager.createWorkspaceFromText(content, getDefaultFilename(linter));
      
      try {
        const result = await linterRunner.runLinter({
          linter,
          workspace_path: workspace.path,
          options,
          timeout_ms: options.timeout || 30000,
        });

        // Cache the result
        await cacheService.set(
          contentHash,
          linter,
          format,
          optionsHash,
          result,
          result.success ? 'success' : 'error'
        );

        logger.info('Linter execution completed', {
          requestId,
          linter,
          success: result.success,
          executionTime: result.execution_time_ms,
        });

        res.json(formatLinterResult(result, format));

      } finally {
        // Cleanup workspace
        await workspaceManager.cleanupWorkspace(workspace.path).catch(err => {
          logger.warn('Failed to cleanup workspace', {
            requestId,
            workspacePath: workspace.path,
            error: err.message,
          });
        });
      }

    } catch (error: any) {
      logger.error('GET request failed', {
        requestId,
        linter,
        format,
        error: error.message,
        stack: error.stack,
      });

      const errorResponse = createErrorResponse({
        code: 'LINTER_EXECUTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        name: error.name || 'LinterError',
        details: { linter, format },
      }, requestId);

      res.status(error.statusCode || 500).json(errorResponse);
    }
  });

  // POST /{linter}/{format} - Full-featured endpoint
  router.post('/:linter/:format', validateParams, async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    const { linter, format } = (req as any).validatedParams;
    
    try {
      logger.info('Processing POST request', {
        requestId,
        linter,
        format,
        bodySize: JSON.stringify(req.body).length,
      });

      // Validate request body
      const validatedBody = PostBodySchema.parse(req.body);
      const options: LinterOptions = {
        validate_all: validatedBody.options.validate_all,
        exclude_patterns: validatedBody.options.exclude_patterns,
        include_patterns: validatedBody.options.include_patterns,
        log_level: validatedBody.options.log_level,
        timeout: validatedBody.options.timeout,
        fix: validatedBody.options.fix,
        ...(validatedBody.options.config_file && { config_file: validatedBody.options.config_file }),
        rules: validatedBody.options.rules,
      };

      // Store for metrics
      (req as any).linterType = linter;
      (req as any).format = format;

      let workspace;
      let contentHash: string;
      
      if (validatedBody.content) {
        // Handle text content
        const filename = validatedBody.filename || getDefaultFilename(linter);
        workspace = await workspaceManager.createWorkspaceFromText(validatedBody.content, filename);
        contentHash = cacheService.generateContentHash(validatedBody.content);
      } else if (validatedBody.archive) {
        // Handle tar.gz archive
        workspace = await workspaceManager.createWorkspaceFromBase64(validatedBody.archive);
        contentHash = cacheService.generateContentHash(validatedBody.archive);
      } else {
        const errorResponse = createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Either content or archive must be provided',
          statusCode: 400,
          name: 'ValidationError',
        }, requestId);
        res.status(400).json(errorResponse);
        return;
      }

      // Generate cache keys
      const optionsHash = cacheService.generateOptionsHash(options);

      // Check cache first
      const cachedResult = await cacheService.get(contentHash, linter, optionsHash);
      if (cachedResult) {
        logger.info('Cache hit for POST request', {
          requestId,
          linter,
          contentHash: contentHash.substring(0, 8),
        });
        
        (req as any).cacheHit = true;
        
        // Cleanup workspace since we're using cache
        await workspaceManager.cleanupWorkspace(workspace.path).catch(() => {});
        
        const parsed = safeParseCachedResult(cachedResult);
        res.json(formatLinterResult(parsed, format));
        return;
      }

      try {
        const result = await linterRunner.runLinter({
          linter,
          workspace_path: workspace.path,
          options,
          timeout_ms: options.timeout || 30000,
        });

        // Cache the result
        await cacheService.set(
          contentHash,
          linter,
          format,
          optionsHash,
          result,
          result.success ? 'success' : 'error'
        );

        logger.info('POST linter execution completed', {
          requestId,
          linter,
          success: result.success,
          executionTime: result.execution_time_ms,
          fileCount: result.file_count,
        });

        res.json(formatLinterResult(result, format));

      } finally {
        // Cleanup workspace
        await workspaceManager.cleanupWorkspace(workspace.path).catch(err => {
          logger.warn('Failed to cleanup workspace', {
            requestId,
            workspacePath: workspace.path,
            error: err.message,
          });
        });
      }

    } catch (error: any) {
      logger.error('POST request failed', {
        requestId,
        linter,
        format,
        error: error.message,
        stack: error.stack,
      });

      // Handle validation errors
      if (error instanceof ZodError) {
        const errorResponse = createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: `Request validation failed: ${error.issues.map((e: any) => e.message).join(', ')}`,
          statusCode: 400,
          name: 'ValidationError',
          details: { errors: error.issues },
        }, requestId);
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse = createErrorResponse({
        code: 'LINTER_EXECUTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        name: error.name || 'LinterError',
        details: { linter, format },
      }, requestId);

      res.status(error.statusCode || 500).json(errorResponse);
    }
  });

  // POST /{linter}/{format}/async - Async job submission
  router.post('/:linter/:format/async', validateParams, async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    const { linter, format } = (req as any).validatedParams;
    
    try {
      logger.info('Processing async POST request', {
        requestId,
        linter,
        format,
        bodySize: JSON.stringify(req.body).length,
      });

      // Validate request body
      const validatedBody = PostBodySchema.parse(req.body);
      const options: LinterOptions = {
        validate_all: validatedBody.options.validate_all,
        exclude_patterns: validatedBody.options.exclude_patterns,
        include_patterns: validatedBody.options.include_patterns,
        log_level: validatedBody.options.log_level,
        timeout: validatedBody.options.timeout,
        fix: validatedBody.options.fix,
        ...(validatedBody.options.config_file && { config_file: validatedBody.options.config_file }),
        rules: validatedBody.options.rules,
      };

      // Submit job
      const jobRequest: any = {
        linter,
        format,
        options,
        requestId,
      };
      
      if (validatedBody.content) {
        jobRequest.content = validatedBody.content;
      }
      
      if (validatedBody.archive) {
        jobRequest.archive = validatedBody.archive;
      }
      
      if (validatedBody.filename) {
        jobRequest.filename = validatedBody.filename;
      }
      
      const jobId = await jobManager.submitJob(jobRequest);

      logger.info('Async job submitted', {
        requestId,
        jobId,
        linter,
        format,
      });

      res.status(202).json({
        success: true,
        job_id: jobId,
        status: 'pending',
        message: 'Job submitted successfully',
        status_url: `/jobs/${jobId}`,
        cancel_url: `/jobs/${jobId}`,
      });

    } catch (error: any) {
      logger.error('Async POST request failed', {
        requestId,
        linter,
        format,
        error: error.message,
        stack: error.stack,
      });

      // Handle validation errors
      if (error instanceof ZodError) {
        const errorResponse = createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: `Request validation failed: ${error.issues.map((e: any) => e.message).join(', ')}`,
          statusCode: 400,
          name: 'ValidationError',
          details: { errors: error.issues },
        }, requestId);
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse = createErrorResponse({
        code: 'LINTER_EXECUTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        name: error.name || 'JobSubmissionError',
        details: { linter, format },
      }, requestId);

      res.status(error.statusCode || 500).json(errorResponse);
    }
  });

  // GET /jobs/{id} - Job status and results
  router.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    const { id } = req.params;
    
    if (!id) {
      const errorResponse = createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Job ID parameter is required',
        statusCode: 400,
        name: 'ValidationError',
      }, requestId);
      res.status(400).json(errorResponse);
      return;
    }
    
    try {
      logger.debug('Getting job status', { requestId, jobId: id });

      const jobResult = await jobManager.getJobStatus(id);
      
      if (!jobResult) {
        const errorResponse = createErrorResponse({
          code: 'JOB_NOT_FOUND',
          message: `Job not found: ${id}`,
          statusCode: 404,
          name: 'NotFoundError',
        }, requestId);
        res.status(404).json(errorResponse);
        return;
      }

      // Format response based on job status
      const response: any = {
        success: true,
        job_id: jobResult.job_id,
        status: jobResult.status,
        created_at: jobResult.created_at,
        started_at: jobResult.started_at,
        completed_at: jobResult.completed_at,
        execution_time_ms: jobResult.execution_time_ms,
      };

      if (jobResult.status === 'completed' && jobResult.result) {
        response.result = jobResult.result;
      } else if (jobResult.status === 'failed' && jobResult.error) {
        response.error = jobResult.error;
      }

      res.json(response);

    } catch (error: any) {
      logger.error('Failed to get job status', {
        requestId,
        jobId: id,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve job status',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  // DELETE /jobs/{id} - Cancel job
  router.delete('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    const { id } = req.params;
    
    if (!id) {
      const errorResponse = createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Job ID parameter is required',
        statusCode: 400,
        name: 'ValidationError',
      }, requestId);
      res.status(400).json(errorResponse);
      return;
    }
    
    try {
      logger.info('Cancelling job', { requestId, jobId: id });

      const cancelled = await jobManager.cancelJob(id);
      
      if (!cancelled) {
        // Check if job exists
        const jobResult = await jobManager.getJobStatus(id);
        if (!jobResult) {
          const errorResponse = createErrorResponse({
            code: 'JOB_NOT_FOUND',
            message: `Job not found: ${id}`,
            statusCode: 404,
            name: 'NotFoundError',
          }, requestId);
          res.status(404).json(errorResponse);
          return;
        }

        // Job exists but cannot be cancelled
        const errorResponse = createErrorResponse({
          code: 'JOB_ALREADY_CANCELLED',
          message: `Job cannot be cancelled. Current status: ${jobResult.status}`,
          statusCode: 409,
          name: 'ConflictError',
        }, requestId);
        res.status(409).json(errorResponse);
        return;
      }

      logger.info('Job cancelled successfully', { requestId, jobId: id });

      res.json({
        success: true,
        job_id: id,
        status: 'cancelled',
        message: 'Job cancelled successfully',
      });

    } catch (error: any) {
      logger.error('Failed to cancel job', {
        requestId,
        jobId: id,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel job',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  // GET /linters - Get available linters information
  router.get('/linters', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    
    try {
      logger.debug('Getting linters information', { requestId });

      // Get linter availability status
      const linterStatus = await linterRunner.getAllLinterStatus();
      
      // Get linter configurations
      const linterConfigs = Object.keys(linterStatus).map(linter => {
        const config = require('../types/linter').LINTER_CONFIGS[linter as LinterType];
        const status = linterStatus[linter as LinterType];
        
        return {
          name: linter,
          description: config?.description || `${linter} code linter`,
          supported_extensions: config?.supported_extensions || [],
          available: status?.available || false,
          version: status?.version,
          fix_supported: config?.fix_supported || false,
          config_file_supported: true, // Most linters support custom config
          default_timeout_ms: 30000,
        };
      });

      res.json({
        success: true,
        linters: linterConfigs,
        total_count: linterConfigs.length,
        available_count: linterConfigs.filter(l => l.available).length,
        supported_formats: ['json', 'text', 'sarif'],
      });

    } catch (error: any) {
      logger.error('Failed to get linters information', {
        requestId,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve linters information',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  // GET /metrics - Get API metrics
  router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    
    try {
      logger.debug('Getting API metrics', { requestId });

      // Get cache stats
      const cacheStats = await cacheService.getPerformanceMetrics();
      
      // Get job stats
      const jobStats = await jobManager.getJobStats();
      
      // Get running jobs
      const runningJobs = await jobManager.getRunningJobs();

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        uptime_ms: process.uptime() * 1000,
        cache: {
          hit_rate_percentage: cacheStats.hit_rate,
          total_requests: cacheStats.total_requests,
          size_mb: cacheStats.cache_size_mb,
        },
        jobs: {
          ...jobStats,
          running_jobs: runningJobs,
          running_count: runningJobs.length,
        },
        system: {
          memory_usage: process.memoryUsage(),
          node_version: process.version,
          platform: process.platform,
          pid: process.pid,
        },
      });

    } catch (error: any) {
      logger.error('Failed to get metrics', {
        requestId,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve metrics',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  // DELETE /cache - Clear cache
  router.delete('/cache', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    
    try {
      logger.info('Clearing cache', { requestId });

      const deletedCount = await cacheService.invalidate();
      
      logger.info('Cache cleared successfully', { requestId, deletedCount });

      res.json({
        success: true,
        message: 'Cache cleared successfully',
        deleted_count: deletedCount,
      });

    } catch (error: any) {
      logger.error('Failed to clear cache', {
        requestId,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to clear cache',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  // GET /cache/stats - Get cache statistics
  router.get('/cache/stats', async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).requestId;
    
    try {
      logger.debug('Getting cache statistics', { requestId });

      const stats = await cacheService.getStats();
      const hitMissStats = cacheService.getHitMissStats();
      
      res.json({
        success: true,
        ...stats,
        session_stats: hitMissStats,
      });

    } catch (error: any) {
      logger.error('Failed to get cache stats', {
        requestId,
        error: error.message,
      });

      const errorResponse = createErrorResponse({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve cache statistics',
        statusCode: 500,
        name: 'InternalError',
      }, requestId);

      res.status(500).json(errorResponse);
    }
  });

  return router;
}

// Helper function to format linter results based on output format
function formatLinterResult(result: any, format: OutputFormat): any {
  switch (format) {
    case 'json':
      return {
        success: result.success,
        exit_code: result.exit_code,
        execution_time_ms: result.execution_time_ms,
        file_count: result.file_count,
        issues: result.issues || [],
        parsed_output: result.parsed_output,
      };
    
    case 'text':
      return {
        success: result.success,
        output: result.stdout || '',
        errors: result.stderr || '',
        exit_code: result.exit_code,
        execution_time_ms: result.execution_time_ms,
      };
    
    case 'sarif':
      return formatToSarif(result);
    
    default:
      return result;
  }
}

// Helper function to convert linter output to SARIF format
function formatToSarif(result: any): any {
  const sarif = {
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'super-linter-api',
            version: '1.0.0',
          },
        },
        results: [],
      },
    ],
  };

  // Convert issues to SARIF results
  if (result.issues && Array.isArray(result.issues)) {
    sarif.runs[0]!.results = result.issues.map((issue: any) => ({
      ruleId: issue.rule || 'unknown',
      message: {
        text: issue.message || 'No message provided',
      },
      level: issue.severity === 'error' ? 'error' : 'warning',
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: issue.file || 'unknown',
            },
            region: {
              startLine: issue.line || 1,
              startColumn: issue.column || 1,
            },
          },
        },
      ],
    }));
  }

  return sarif;
}

// Helper to safely parse cached DB result back to linter result shape
function safeParseCachedResult(cached: any): any {
  try {
    if (cached && typeof cached.result === 'string') {
      return JSON.parse(cached.result);
    }
  } catch {
    // Fallback to minimal shape if parsing fails
  }
  return cached;
}

// Helper function to get default filename for linter type
function getDefaultFilename(linter: LinterType): string {
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
