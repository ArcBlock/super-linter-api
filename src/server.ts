import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { DatabaseService } from './services/database';
import { WorkspaceManager } from './services/workspace';
import { LinterRunner } from './services/linter';
import { CacheService } from './services/cache';
import { JobManager } from './services/jobManager';
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

// Initialize services
const db = new DatabaseService();
const workspaceManager = new WorkspaceManager();
const linterRunner = new LinterRunner(workspaceManager);
const cacheService = new CacheService(db);
const jobManager = new JobManager(db, workspaceManager, linterRunner, cacheService);

// Create Express app
const app: express.Application = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

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

// Request ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
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

    // Record metrics
    db.recordMetric({
      endpoint: req.route?.path || req.path,
      method: req.method as any,
      status_code: res.statusCode,
      response_time_ms: duration,
      cache_hit: (req as any).cacheHit || false,
      linter_type: (req as any).linterType,
      format: (req as any).format,
      error_type: res.statusCode >= 400 ? 'client_error' : undefined as any,
    }).catch(err => {
      logger.warn('Failed to record metrics', { error: err.message });
    });
  });

  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const health = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbHealth.status === 'healthy',
        filesystem: true, // TODO: Add filesystem check
        linters: true, // TODO: Add linter availability check
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
app.get('/', (req, res) => {
  res.json({
    name: 'Super Linter API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'HTTP API layer for Super-linter providing Kroki-style REST endpoints',
    endpoints: {
      health: '/health',
      linters: '/linters',
      metrics: '/metrics',
      lint_sync: '/{linter}/{format}',
      lint_async: '/{linter}/{format}/async',
      job_status: '/jobs/{id}',
    },
    documentation: 'https://github.com/your-org/super-linter-api',
  });
});

// Mount API routes
app.use(createLinterRouter(workspaceManager, linterRunner, cacheService, db, jobManager));

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export { app, server };