# API Documentation

Complete reference for the Super-linter API endpoints, request/response formats, and integration examples.

## 🔗 **Base URL**

```
http://localhost:3000    # Local development
https://your-domain.com  # Production deployment
```

## 📋 **Endpoints Overview**

| Endpoint | Method | Description | Use Case |
|----------|--------|-------------|----------|
| `GET /` | GET | API information | Service discovery |
| `GET /health` | GET | Health check | Monitoring, readiness |
| `GET /linters` | GET | Available linters | Client configuration |
| `POST /{linter}/{format}` | POST | Synchronous linting | Real-time feedback |
| `POST /{linter}/{format}/async` | POST | Asynchronous linting | Long-running jobs |
| `GET /jobs/{job_id}` | GET | Job status/results | Async job tracking |
| `DELETE /jobs/{job_id}` | DELETE | Cancel job | Job management |
| `GET /metrics` | GET | API metrics | Monitoring, analytics |
| `DELETE /cache` | DELETE | Clear cache | Cache management |

---

## 🔍 **Core Endpoints**

### GET / - API Information

Returns basic API information and available linters.

**Request:**
```bash
curl http://localhost:3000/
```

**Response:**
```json
{
  "name": "Super-linter API",
  "version": "1.0.0",
  "description": "HTTP API for code linting",
  "environment": "Super-linter",
  "runtime": {
    "superlinter": true,
    "containerized": true,
    "availableLinters": 18
  },
  "endpoints": {
    "health": "/health",
    "linters": "/linters",
    "lint_sync": "/{linter}/{format}",
    "lint_async": "/{linter}/{format}/async"
  }
}
```

### GET /health - Health Check

System health and status information.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": {
    "superlinter": true,
    "containerized": true,
    "nodeVersion": "v19.7.0",
    "platform": "linux"
  },
  "checks": {
    "database": true,
    "filesystem": true,
    "linters": true
  },
  "linters": {
    "total": 21,
    "available_count": 16,
    "available": [
      "eslint", "oxlint", "biome", "biome-lint", "prettier",
      "pylint", "flake8", "black", "isort", "mypy",
      "shellcheck", "golangci-lint", "hadolint", "yamllint",
      "markdownlint", "stylelint"
    ]
  },
  "uptime_ms": 1234567
}
```

### GET /linters - Available Linters

Detailed information about all configured linters.

**Request:**
```bash
curl http://localhost:3000/linters
```

**Response:**
```json
{
  "success": true,
  "linters": [
    {
      "name": "eslint",
      "description": "ESLint JavaScript linter",
      "supported_extensions": [".js", ".jsx", ".ts", ".tsx", ".vue"],
      "available": true,
      "version": "8.38.0",
      "fix_supported": true,
      "config_file_supported": true,
      "default_timeout_ms": 30000
    }
  ],
  "total_count": 21,
  "available_count": 16,
  "supported_formats": ["json", "text", "sarif"]
}
```

---

## 🚀 **Linting Endpoints**

### POST /{linter}/{format} - Synchronous Linting

Lint code synchronously and get immediate results.

**URL Parameters:**
- `linter`: Linter name (eslint, oxlint, pylint, etc.)
- `format`: Output format (json, text, sarif)

**Request Body Options:**

#### 1. Plain Text Content
```bash
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: text/plain" \
  -d 'console.log("Hello World"); var unused = 42;'
```

#### 2. JSON with Content
```bash
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: application/json" \
  -d '{
    "content": "console.log(\"Hello World\"); var unused = 42;",
    "filename": "test.js",
    "options": {
      "timeout": 15000,
      "log_level": "INFO"
    }
  }'
```

#### 3. Base64 Archive Upload
```bash
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: application/json" \
  -d '{
    "archive": "<base64-encoded-tar.gz>",
    "options": {
      "validate_all": true,
      "exclude_patterns": ["node_modules/**", "*.min.js"],
      "include_patterns": ["src/**/*.js"]
    }
  }'
```

**Linter Options:**
```json
{
  "options": {
    "validate_all": false,        // Lint all files vs first file only
    "exclude_patterns": [],       // Files/dirs to exclude
    "include_patterns": [],       // Files/dirs to include  
    "log_level": "INFO",         // DEBUG, INFO, WARN, ERROR
    "timeout": 30000,            // Timeout in milliseconds
    "fix": false,                // Apply auto-fixes if supported
    "config_file": ".eslintrc.json", // Custom config file
    "rules": {                   // Override specific rules
      "no-console": "warn",
      "semi": "error"
    }
  }
}
```

**Response (JSON format):**
```json
{
  "success": true,
  "exit_code": 1,
  "execution_time_ms": 245,
  "file_count": 1,
  "issues": [
    {
      "file": "test.js",
      "line": 1,
      "column": 5,
      "rule": "no-unused-vars",
      "severity": "error",
      "message": "'unused' is assigned a value but never used.",
      "source": "eslint"
    }
  ],
  "parsed_output": {
    "summary": {
      "errors": 1,
      "warnings": 0,
      "fixable": 0
    }
  }
}
```

**Response (Text format):**
```json
{
  "success": true,
  "output": "test.js:1:5: error: 'unused' is assigned a value but never used. (no-unused-vars)",
  "errors": "",
  "exit_code": 1,
  "execution_time_ms": 245
}
```

### POST /{linter}/{format}/async - Asynchronous Linting

Submit long-running linting jobs and get results later.

**Request:**
```bash
curl -X POST http://localhost:3000/eslint/json/async \
  -H "Content-Type: application/json" \
  -d '{
    "content": "console.log(\"Hello World\");",
    "options": {
      "timeout": 60000
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "pending",
  "message": "Job submitted successfully",
  "status_url": "/jobs/job_1642234567890_abc123",
  "cancel_url": "/jobs/job_1642234567890_abc123"
}
```

---

## 📊 **Job Management**

### GET /jobs/{job_id} - Get Job Status

Check the status and results of an asynchronous job.

**Request:**
```bash
curl http://localhost:3000/jobs/job_1642234567890_abc123
```

**Response (Pending):**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Response (Running):**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123", 
  "status": "running",
  "created_at": "2024-01-15T10:30:00.000Z",
  "started_at": "2024-01-15T10:30:05.000Z"
}
```

**Response (Completed):**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "completed",
  "created_at": "2024-01-15T10:30:00.000Z",
  "started_at": "2024-01-15T10:30:05.000Z", 
  "completed_at": "2024-01-15T10:30:08.000Z",
  "execution_time_ms": 3000,
  "result": {
    "success": true,
    "exit_code": 0,
    "issues": [],
    "file_count": 1
  }
}
```

**Response (Failed):**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "failed", 
  "created_at": "2024-01-15T10:30:00.000Z",
  "started_at": "2024-01-15T10:30:05.000Z",
  "completed_at": "2024-01-15T10:30:07.000Z",
  "execution_time_ms": 2000,
  "error": "Linter execution timeout after 30000ms"
}
```

### DELETE /jobs/{job_id} - Cancel Job

Cancel a running or pending job.

**Request:**
```bash
curl -X DELETE http://localhost:3000/jobs/job_1642234567890_abc123
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "cancelled",
  "message": "Job cancelled successfully"
}
```

---

## 📈 **Monitoring & Management**

### GET /metrics - API Metrics

Get performance and usage metrics.

**Request:**
```bash
curl http://localhost:3000/metrics
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime_ms": 3600000,
  "cache": {
    "hit_rate_percentage": 85.2,
    "total_requests": 1543,
    "size_mb": 12.3
  },
  "jobs": {
    "pending": 2,
    "running": 1,
    "completed_last_24h": 234,
    "failed_last_24h": 12,
    "running_jobs": [
      {
        "job_id": "job_123",
        "status": "running",
        "linter": "pylint", 
        "started_at": "2024-01-15T10:25:00.000Z"
      }
    ],
    "running_count": 1
  },
  "system": {
    "memory_usage": {
      "rss": 45678912,
      "heapTotal": 23456789,
      "heapUsed": 12345678
    },
    "node_version": "v19.7.0",
    "platform": "linux"
  }
}
```

### DELETE /cache - Clear Cache

Clear the internal result cache.

**Request:**
```bash
curl -X DELETE http://localhost:3000/cache
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "deleted_count": 156
}
```

---

## 🚨 **Error Responses**

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error context",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "request_id": "req_1642234567890_xyz789"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INVALID_PARAMETERS` | 400 | Invalid linter or format |
| `UNSUPPORTED_FORMAT` | 400 | Linter doesn't support format |
| `LINTER_EXECUTION_FAILED` | 500 | Linter execution error |
| `TIMEOUT_ERROR` | 408 | Request timeout |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `JOB_NOT_FOUND` | 404 | Job ID not found |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Example Error Responses

**Invalid Linter:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS", 
    "message": "Invalid linter: 'invalid-linter'",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Linter Execution Failed:**
```json
{
  "success": false,
  "error": {
    "code": "LINTER_EXECUTION_FAILED",
    "message": "ESLint execution failed: Parse error at line 1",
    "details": {
      "linter": "eslint",
      "format": "json",
      "exit_code": 2
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 🔧 **Integration Examples**

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    services:
      linter-api:
        image: arcblock/super-linter-api:latest
        ports: ["3000:3000"]
        
    steps:
      - uses: actions/checkout@v3
      
      - name: Lint JavaScript
        run: |
          response=$(curl -s -X POST http://localhost:3000/eslint/json \
            -d "{\"archive\": \"$(tar czf - . | base64 -w 0)\"}")
          
          success=$(echo "$response" | jq -r '.success')
          if [ "$success" != "true" ]; then
            echo "Linting failed:"
            echo "$response" | jq '.issues[]'
            exit 1
          fi
```

### Node.js Client

```javascript
const axios = require('axios');

class LinterAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({ baseURL });
  }
  
  async lintCode(linter, code, options = {}) {
    try {
      const response = await this.client.post(`/${linter}/json`, {
        content: code,
        options
      });
      return response.data;
    } catch (error) {
      throw new Error(`Linting failed: ${error.response?.data?.error?.message}`);
    }
  }
  
  async lintAsync(linter, code, options = {}) {
    const response = await this.client.post(`/${linter}/json/async`, {
      content: code,
      options
    });
    return response.data.job_id;
  }
  
  async getJobResult(jobId) {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }
}

// Usage
const linter = new LinterAPI();

const result = await linter.lintCode('eslint', 'console.log("hello");');
console.log('Issues found:', result.issues.length);
```

### Python Client

```python
import requests
import json
import time

class LinterAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        
    def lint_code(self, linter, code, options=None):
        url = f"{self.base_url}/{linter}/json"
        payload = {
            'content': code,
            'options': options or {}
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    
    def lint_async(self, linter, code, options=None):
        url = f"{self.base_url}/{linter}/json/async" 
        payload = {
            'content': code,
            'options': options or {}
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()['job_id']
    
    def wait_for_job(self, job_id, timeout=60):
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            response = requests.get(f"{self.base_url}/jobs/{job_id}")
            job_data = response.json()
            
            if job_data['status'] in ['completed', 'failed', 'cancelled']:
                return job_data
                
            time.sleep(1)
            
        raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")

# Usage
linter = LinterAPI()

# Synchronous linting
result = linter.lint_code('pylint', 'print("hello world")')
print(f"Found {len(result['issues'])} issues")

# Asynchronous linting  
job_id = linter.lint_async('pylint', large_code_file)
final_result = linter.wait_for_job(job_id)
```

---

## 🔄 **Rate Limiting**

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit info in response headers
- **Burst**: Up to 10 concurrent requests

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642235567
```

**Rate Limit Error:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 🔒 **Authentication**

Currently, the API does not require authentication. For production deployments, consider:

- **Reverse proxy** with authentication (nginx, Traefik)
- **API Gateway** integration (AWS API Gateway, Kong)
- **Network isolation** (VPC, firewall rules)
- **Rate limiting** by API key

Future versions may include built-in authentication options.

---

*This API documentation is automatically updated. Last updated: $(date).*