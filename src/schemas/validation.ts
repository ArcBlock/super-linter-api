import { z } from 'zod';
import { LinterType, OutputFormat } from '../types/api';

export const LinterTypeSchema = z.enum([
  'eslint',
  'prettier',
  'jshint',
  'pylint',
  'flake8',
  'black',
  'isort',
  'bandit',
  'mypy',
  'shellcheck',
  'golangci-lint',
  'gofmt',
  'rubocop',
  'hadolint',
  'yamllint',
  'jsonlint',
  'markdownlint',
  'stylelint',
] as const);

export const OutputFormatSchema = z.enum(['json', 'text', 'sarif'] as const);

export const LinterOptionsSchema = z
  .object({
    validate_all: z.boolean().optional(),
    exclude_patterns: z.array(z.string()).optional(),
    include_patterns: z.array(z.string()).optional(),
    log_level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
    timeout: z.number().int().min(1000).max(600000).optional(), // 1s to 10min
    fix: z.boolean().optional(),
    config_file: z.string().optional(),
    rules: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const LintRequestSchema = z
  .object({
    content: z.union([z.string(), z.instanceof(Buffer)]),
    options: LinterOptionsSchema.optional(),
  })
  .strict();

export const EncodedLintRequestSchema = z
  .object({
    encoded_content: z.string(),
    options: LinterOptionsSchema.optional(),
  })
  .strict();

// URL parameter validation
export const LinterParamSchema = z.object({
  linter: LinterTypeSchema,
  format: OutputFormatSchema,
});

export const EncodedParamSchema = z.object({
  linter: LinterTypeSchema,
  format: OutputFormatSchema,
  encoded: z.string(),
});

export const JobParamSchema = z.object({
  id: z.string().min(1),
});

// Query parameter validation
export const LintQuerySchema = z
  .object({
    validate_all: z
      .string()
      .transform(val => val === 'true')
      .optional(),
    exclude_patterns: z
      .string()
      .transform(val => val.split(','))
      .optional(),
    include_patterns: z
      .string()
      .transform(val => val.split(','))
      .optional(),
    log_level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
    timeout: z
      .string()
      .transform(val => parseInt(val, 10))
      .pipe(z.number().int().min(1000).max(600000))
      .optional(),
    fix: z
      .string()
      .transform(val => val === 'true')
      .optional(),
  })
  .strict();

// Content size validation
export const MAX_CONTENT_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_ENCODED_SIZE = 100 * 1024 * 1024; // 100MB for base64 encoded

export const ContentSizeSchema = z.string().max(MAX_CONTENT_SIZE);

export const EncodedContentSizeSchema = z.string().max(MAX_ENCODED_SIZE);

// File extension validation
export const ALLOWED_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.py',
  '.pyi',
  '.rb',
  '.rake',
  '.go',
  '.rs',
  '.kt',
  '.kts',
  '.swift',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.yml',
  '.yaml',
  '.json',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.php',
  '.c',
  '.cpp',
  '.cc',
  '.cxx',
  '.h',
  '.hpp',
  '.java',
  'Dockerfile',
  '.dockerfile',
] as const;

export const FileExtensionSchema = z.enum(ALLOWED_EXTENSIONS);

// Workspace validation
export const MAX_FILES_PER_WORKSPACE = 10000;
export const MAX_WORKSPACE_SIZE = 500 * 1024 * 1024; // 500MB

export const WorkspaceValidationSchema = z.object({
  file_count: z.number().int().min(1).max(MAX_FILES_PER_WORKSPACE),
  total_size: z.number().int().min(1).max(MAX_WORKSPACE_SIZE),
  allowed_extensions: z.array(FileExtensionSchema),
});

// Rate limiting validation
export const RateLimitSchema = z.object({
  requests_per_minute: z.number().int().min(1).max(1000).default(60),
  requests_per_hour: z.number().int().min(1).max(10000).default(1000),
  burst_limit: z.number().int().min(1).max(100).default(10),
});

// Job creation validation
export const CreateJobSchema = z
  .object({
    content: z.union([z.string(), z.instanceof(Buffer)]),
    linter_type: LinterTypeSchema,
    format: OutputFormatSchema,
    options: LinterOptionsSchema.optional(),
  })
  .strict();

// Health check validation
export const HealthCheckSchema = z.object({
  include_details: z
    .string()
    .transform(val => val === 'true')
    .optional(),
});

// Validation helper functions
export function validateLinterSupportsFormat(linter: LinterType, format: OutputFormat): boolean {
  // Some linters don't support all formats
  const formatSupport: Record<LinterType, OutputFormat[]> = {
    eslint: ['json', 'text'],
    oxlint: ['json', 'text'],
    biome: ['json', 'text'],
    'biome-lint': ['json', 'text'],
    prettier: ['text'],
    jshint: ['json', 'text'],
    pylint: ['json', 'text'],
    flake8: ['text'],
    black: ['text'],
    isort: ['text'],
    bandit: ['json', 'text'],
    mypy: ['text'],
    shellcheck: ['json', 'text'],
    'golangci-lint': ['json', 'text'],
    gofmt: ['text'],
    rubocop: ['json', 'text'],
    hadolint: ['json', 'text'],
    yamllint: ['text'],
    jsonlint: ['text'],
    markdownlint: ['json', 'text'],
    stylelint: ['json', 'text'],
  };

  return formatSupport[linter]?.includes(format) ?? true;
}

export function validateContentEncoding(encoded: string): { valid: boolean; error?: string } {
  try {
    // Check if it's valid base64
    const decoded = Buffer.from(encoded, 'base64');
    if (Buffer.from(decoded.toString('base64'), 'base64').equals(decoded)) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid base64 encoding' };
  } catch {
    return { valid: false, error: 'Failed to decode base64 content' };
  }
}

// Custom validation middleware
export const validationMiddleware = {
  linterParams: (req: any, res: any, next: any) => {
    try {
      const result = LinterParamSchema.parse(req.params);
      req.validatedParams = result;

      // Additional validation for format support
      if (!validateLinterSupportsFormat(result.linter, result.format)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: `Linter ${result.linter} does not support format ${result.format}`,
            timestamp: new Date().toISOString(),
          },
        });
      }

      next();
    } catch (validationError: unknown) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: (validationError as any).errors || (validationError as any).message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  },

  lintRequest: (req: any, res: any, next: any) => {
    try {
      const result = LintRequestSchema.parse(req.body);
      req.validatedBody = result;
      next();
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: (error as any).errors || (error as any).message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  },

  queryParams: (req: any, res: any, next: any) => {
    try {
      const result = LintQuerySchema.parse(req.query);
      req.validatedQuery = result;
      next();
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: (error as any).errors || (error as any).message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
};
