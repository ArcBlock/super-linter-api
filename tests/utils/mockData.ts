/**
 * Mock data for testing Super-linter API
 */

export const mockLintRequest = {
  content: {
    'test.js': `
console.log("Hello World");
function add(a,b){return a+b;}
    `,
    'test.py': `
def greet(name):
    return f"Hello {name}"
print(greet("World"))
    `
  },
  options: {
    validate_all: true,
    log_level: 'INFO',
    timeout: 30
  }
};

export const mockLintResult = {
  success: true,
  results: {
    'javascript': {
      files_linted: 1,
      errors_found: 2,
      files: {
        'test.js': {
          issues: [
            {
              line: 2,
              column: 1,
              rule: 'no-console',
              message: 'Unexpected console statement.',
              severity: 'warning'
            }
          ]
        }
      }
    }
  },
  summary: {
    total_files: 2,
    files_with_issues: 1,
    total_issues: 1
  },
  execution_time: 1.5,
  cache_hit: false
};

export const mockJobData = {
  id: 'job_123456789',
  status: 'pending',
  linter: 'javascript',
  format: 'json',
  created_at: new Date().toISOString(),
  started_at: null,
  completed_at: null,
  result: null,
  error: null
};

export const mockCacheData = {
  cache_key: 'abc123def456',
  content: JSON.stringify(mockLintResult),
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600000).toISOString()
};

export const mockWorkspaceFiles = {
  'package.json': JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    scripts: {
      test: 'jest'
    },
    devDependencies: {
      jest: '^29.0.0'
    }
  }, null, 2),
  
  'src/index.js': `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
  `,

  'src/utils.js': `
function calculateSum(numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

module.exports = {
  calculateSum,
  formatDate
};
  `,

  '.eslintrc.json': JSON.stringify({
    env: {
      node: true,
      es2021: true
    },
    extends: ['eslint:recommended'],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module'
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'error'
    }
  }, null, 2)
};

export const mockMetrics = {
  total_requests: 1250,
  requests_last_24h: 45,
  cache_hit_rate: 0.73,
  average_response_time: 2.3,
  active_jobs: 3,
  completed_jobs: 1247,
  failed_jobs: 12,
  database_size: '2.5MB',
  uptime: '5 days, 3 hours, 22 minutes'
};

export const mockLinterInfo = {
  javascript: {
    name: 'JavaScript (ESLint)',
    version: '8.0.0',
    file_types: ['.js', '.jsx'],
    description: 'Lints JavaScript and JSX files using ESLint'
  },
  typescript: {
    name: 'TypeScript (TSLint/ESLint)',
    version: '4.5.0',
    file_types: ['.ts', '.tsx'],
    description: 'Lints TypeScript files'
  },
  python: {
    name: 'Python (Flake8, Black)',
    version: '3.9.0',
    file_types: ['.py'],
    description: 'Lints Python files with Flake8 and formats with Black'
  }
};

export const mockErrorResponses = {
  invalidLinter: {
    error: 'Invalid linter type',
    message: 'Linter "invalid-linter" is not supported',
    supported_linters: ['javascript', 'typescript', 'python']
  },
  
  invalidFormat: {
    error: 'Invalid format',
    message: 'Format "invalid-format" is not supported',
    supported_formats: ['json', 'text', 'sarif']
  },

  invalidContent: {
    error: 'Invalid content',
    message: 'Request content is empty or invalid'
  },

  jobNotFound: {
    error: 'Job not found',
    message: 'Job with ID "invalid-job-id" was not found'
  },

  rateLimitExceeded: {
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    retry_after: 60
  }
};