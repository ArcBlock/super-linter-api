export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'INVALID_PARAMETERS'
  | 'INVALID_CONTENT_ENCODING'
  | 'LINTER_NOT_FOUND'
  | 'LINTER_EXECUTION_FAILED'
  | 'TIMEOUT_ERROR'
  | 'WORKSPACE_ERROR'
  | 'CACHE_ERROR'
  | 'DATABASE_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONTENT_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'JOB_NOT_FOUND'
  | 'JOB_ALREADY_CANCELLED'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NOT_FOUND';

export interface ApiError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  requestId?: string;
}

export class ValidationError extends Error implements ApiError {
  code: ErrorCode = 'VALIDATION_ERROR';
  statusCode = 400;
  details?: any;
  requestId?: string;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class LinterError extends Error implements ApiError {
  code: ErrorCode;
  statusCode = 422;
  details?: any;
  requestId?: string;

  constructor(code: Extract<ErrorCode, 'LINTER_NOT_FOUND' | 'LINTER_EXECUTION_FAILED'>, message: string, details?: any) {
    super(message);
    this.name = 'LinterError';
    this.code = code;
    this.details = details;
  }
}

export class TimeoutError extends Error implements ApiError {
  code: ErrorCode = 'TIMEOUT_ERROR';
  statusCode = 408;
  details?: any;
  requestId?: string;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
    this.details = { timeoutMs };
  }
}

export class WorkspaceError extends Error implements ApiError {
  code: ErrorCode = 'WORKSPACE_ERROR';
  statusCode = 422;
  details?: any;
  requestId?: string;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'WorkspaceError';
    this.details = details;
  }
}

export class CacheError extends Error implements ApiError {
  code: ErrorCode = 'CACHE_ERROR';
  statusCode = 500;
  details?: any;
  requestId?: string;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'CacheError';
    this.details = details;
  }
}

export class DatabaseError extends Error implements ApiError {
  code: ErrorCode = 'DATABASE_ERROR';
  statusCode = 500;
  details?: any;
  requestId?: string;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'DatabaseError';
    this.details = details;
  }
}

export class RateLimitError extends Error implements ApiError {
  code: ErrorCode = 'RATE_LIMIT_EXCEEDED';
  statusCode = 429;
  details?: any;
  requestId?: string;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.details = { retryAfter };
  }
}

export class ContentTooLargeError extends Error implements ApiError {
  code: ErrorCode = 'CONTENT_TOO_LARGE';
  statusCode = 413;
  details?: any;
  requestId?: string;

  constructor(message: string, maxSize: number, actualSize: number) {
    super(message);
    this.name = 'ContentTooLargeError';
    this.details = { maxSize, actualSize };
  }
}

export class UnsupportedFormatError extends Error implements ApiError {
  code: ErrorCode = 'UNSUPPORTED_FORMAT';
  statusCode = 400;
  details?: any;
  requestId?: string;

  constructor(message: string, format: string, supportedFormats: string[]) {
    super(message);
    this.name = 'UnsupportedFormatError';
    this.details = { format, supportedFormats };
  }
}

export class JobNotFoundError extends Error implements ApiError {
  code: ErrorCode = 'JOB_NOT_FOUND';
  statusCode = 404;
  details?: any;
  requestId?: string;

  constructor(jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'JobNotFoundError';
    this.details = { jobId };
  }
}

export class InternalServerError extends Error implements ApiError {
  code: ErrorCode = 'INTERNAL_SERVER_ERROR';
  statusCode = 500;
  details?: any;
  requestId?: string;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'InternalServerError';
    this.details = details;
  }
}

export class ServiceUnavailableError extends Error implements ApiError {
  code: ErrorCode = 'SERVICE_UNAVAILABLE';
  statusCode = 503;
  details?: any;
  requestId?: string;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'ServiceUnavailableError';
    this.details = { retryAfter };
  }
}

export function createErrorResponse(error: ApiError, requestId?: string): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    request_id?: string;
  };
} {
  const finalRequestId = requestId || error.requestId;
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      ...(finalRequestId && { request_id: finalRequestId }),
    },
  };
}