import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { DatabaseService } from './services/database';
import { WorkspaceManager } from './services/workspace';
import { LinterRunner } from './services/linter';
import { SuperLinterRunner } from './services/superLinterRunner';
import { CacheService } from './services/cache';
import { JobManager } from './services/jobManager';
import { EnvironmentDetector } from './services/environmentDetector';
import { createLinterRouter } from './routes/linter';
import { createErrorResponse } from './types/errors';

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize services with environment detection
async function initializeServices() {
  // Detect environment capabilities
  const capabilities = await EnvironmentDetector.detectCapabilities();

  logger.info('Environment detected', {
    superlinterEnvironment: capabilities.isSuperlinterEnvironment,
    containerized: capabilities.containerized,
    availableLinters: capabilities.availableLinters.length,
    nodeVersion: capabilities.nodeVersion,
  });

  const db = new DatabaseService();
  const workspaceManager = new WorkspaceManager(process.env.DEFAULT_WORKSPACE);

  // Choose the appropriate linter runner based on environment
  const linterRunner = capabilities.isSuperlinterEnvironment
    ? new SuperLinterRunner(workspaceManager)
    : new LinterRunner(workspaceManager);

  logger.info(`Using ${capabilities.isSuperlinterEnvironment ? 'SuperLinterRunner' : 'LinterRunner'}`, {
    reason: capabilities.isSuperlinterEnvironment ? 'Super-linter environment detected' : 'Standard environment - ESLint only'
  });

  const cacheService = new CacheService(db);
  const jobManager = new JobManager(db, workspaceManager, linterRunner, cacheService);

  return { db, workspaceManager, linterRunner, cacheService, jobManager };
}

// Create Express app
const app: express.Application = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Compression
app.use(compression({
  threshold: 1024, // Only compress if larger than 1KB
  level: 6, // Balanced compression level
}));

// Body parsing
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.text({ limit: '50mb' })); // Add text parsing for plain text content
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      timestamp: new Date().toISOString(),
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Request ID middleware - check common proxy headers first
app.use((req, res, next) => {
  // Check for existing request ID from various proxy headers
  // Express.js automatically normalizes headers to lowercase
  const existingRequestId =
    req.headers['x-request-id'] ||
    req.headers['request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-trace-id'] ||
    req.headers['traceparent']; // W3C trace context

  // Validate existing request ID (must be non-empty string, reasonable length)
  const isValidRequestId = (id: any): id is string => {
    return typeof id === 'string' &&
           id.trim().length > 0 &&
           id.length <= 256 && // Reasonable max length
           !/[\r\n\t\0]/.test(id) && // No control characters
           id === id.trim(); // No leading/trailing whitespace
  };

  // Only generate new requestId if none found or invalid in headers
  const requestId = isValidRequestId(existingRequestId)
    ? existingRequestId
    : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  (req as any).requestId = requestId;

  // Always set the response header for downstream services
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = (req as any).requestId;

  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
    });

    // Record metrics if services are initialized
    if (globalServices?.db) {
      globalServices.db.recordMetric({
        endpoint: req.route?.path || req.path,
        method: req.method as any,
        status_code: res.statusCode,
        response_time_ms: duration,
        cache_hit: (req as any).cacheHit || false,
        linter_type: (req as any).linterType,
        format: (req as any).format,
        error_type: res.statusCode >= 400 ? 'client_error' : undefined as any,
      }).catch((err: any) => {
        logger.warn('Failed to record metrics', { error: err.message });
      });
    }
  });

  next();
});

// Global services variable (will be initialized async)
let globalServices: any = null;

// Async startup function
async function startServer() {
  // Initialize services based on environment
  const services = await initializeServices();
  const { db, workspaceManager, linterRunner, cacheService, jobManager } = services;

  // Store services globally for middleware access
  globalServices = services;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const capabilities = await EnvironmentDetector.detectCapabilities();

    const health = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        superlinter: capabilities.isSuperlinterEnvironment,
        containerized: capabilities.containerized,
        nodeVersion: capabilities.nodeVersion,
        platform: capabilities.platform,
      },
      checks: {
        database: dbHealth.status === 'healthy',
        filesystem: true,
        linters: capabilities.availableLinters.length > 0,
      },
      linters: {
        count: capabilities.availableLinters.length,
        available: capabilities.availableLinters.slice(0, 10), // Show first 10
      },
      uptime_ms: process.uptime() * 1000,
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Basic info endpoint
app.get('/', async (req, res) => {
  const capabilities = await EnvironmentDetector.detectCapabilities();

  res.json({
    name: 'Super Linter API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'HTTP API layer for Super-linter providing Kroki-style REST endpoints',
    environment: capabilities.isSuperlinterEnvironment ? 'Super-linter' : 'Standard (ESLint only)',
    runtime: {
      superlinter: capabilities.isSuperlinterEnvironment,
      containerized: capabilities.containerized,
      availableLinters: capabilities.availableLinters.length,
    },
    endpoints: {
      health: '/health',
      linters: '/linters',
      metrics: '/metrics',
      lint_sync: '/{linter}/{format}',
      lint_async: '/{linter}/{format}/async',
      job_status: '/jobs/{id}',
    },
    documentation: 'https://github.com/arcblock/super-linter-api',
  });
});

// Mount API routes
app.use(createLinterRouter(workspaceManager, linterRunner, cacheService, db, jobManager));

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as any).requestId;

  logger.error('Unhandled error', {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
  });

  // Don't expose internal errors in production
  const isDev = NODE_ENV === 'development';
  const errorResponse = createErrorResponse({
    code: 'INTERNAL_SERVER_ERROR',
    message: isDev ? error.message : 'Internal server error',
    statusCode: error.statusCode || 500,
    name: error.name,
    details: isDev ? { stack: error.stack } : undefined,
  }, requestId);

  res.status(error.statusCode || 500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  const requestId = (req as any).requestId;

  const errorResponse = createErrorResponse({
    code: 'NOT_FOUND',
    message: `Endpoint not found: ${req.method} ${req.path}`,
    statusCode: 404,
    name: 'NotFoundError',
  }, requestId);

  res.status(404).json(errorResponse);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Super Linter API server started`, {
    port: PORT,
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('Server error', { error: error.message });
  }
});

  return { app, server, services };
}

// Start the application
startServer().catch((error) => {
  logger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});

export { app };
