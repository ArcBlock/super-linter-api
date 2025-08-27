# Endpoints

This section provides a complete technical reference for every API endpoint. It covers URL structures, HTTP methods, parameters, request bodies, and example responses. For detailed information on the data structures used in requests and responses, see the [Data Types](./api-reference-data-types.md) section. For a guide on handling errors, refer to the [Error Codes](./api-reference-error-codes.md) section.

## Service & Health

These endpoints provide basic information and health status for the API service.

### GET / - API Information

Returns general information about the API, its version, and the environment it's running in.

**Example Request:**

```bash
curl http://localhost:3000/
```

**Example Response:**

```json
{
  "name": "Super Linter API",
  "version": "1.0.0",
  "description": "HTTP API layer for Super-linter providing Kroki-style REST endpoints",
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
    "lint_async": "/{linter}/{format}/async",
    "job_status": "/jobs/{id}"
  },
  "documentation": "https://github.com/arcblock/super-linter-api"
}
```

### GET /health - Health Check

Provides a detailed health status of the API and its dependencies, such as the database and the availability of linters. Returns an HTTP `200` status if healthy or `503` if degraded or unhealthy.

**Example Request:**

```bash
curl http://localhost:3000/health
```

**Example Response:**

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
      "eslint",
      "pylint",
      "shellcheck",
      "golangci-lint",
      "hadolint",
      "yamllint",
      "markdownlint"
    ]
  },
  "uptime_ms": 1234567
}
```

## Configuration & Discovery

This endpoint helps clients discover which linters are available and their capabilities.

### GET /linters - List Available Linters

Returns a detailed list of all configured linters, their availability, supported features, and versions.

**Example Request:**

```bash
curl http://localhost:3000/linters
```

**Example Response:**

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
    },
    {
      "name": "pylint",
      "description": "pylint code linter",
      "supported_extensions": [],
      "available": true,
      "version": "2.17.2",
      "fix_supported": false,
      "config_file_supported": true,
      "default_timeout_ms": 30000
    }
  ],
  "total_count": 21,
  "available_count": 16,
  "supported_formats": ["json", "text", "sarif"]
}
```

## Core Linting

These are the primary endpoints for executing linting tasks.

### POST /{linter}/{format} - Synchronous Linting

Submits code for immediate, synchronous analysis. The request will block until the linting process is complete and returns the full result in the response body.

**URL Parameters**

| Parameter | Type   | Description                                           |
|-----------|--------|-------------------------------------------------------|
| `linter`  | string | The name of the linter to use (e.g., `eslint`, `pylint`). |
| `format`  | string | The desired output format (`json`, `text`, or `sarif`).   |

**Request Body**

The body can be provided in several ways:

1.  **Plain Text:** Send the raw code with a `Content-Type: text/plain` header.
2.  **JSON with Content:** Send a JSON object with a `content` field containing the code.
3.  **JSON with Archive:** Send a JSON object with an `archive` field containing a base64-encoded `.tar.gz` file of a project.

**Linter Options**

Options can be provided within a JSON request body to customize the linter's behavior.

| Option             | Type          | Default   | Description                                                               |
|--------------------|---------------|-----------|---------------------------------------------------------------------------|
| `content`          | string        | -         | The source code to lint. Required if `archive` is not provided.           |
| `archive`          | string        | -         | A base64-encoded tar.gz archive. Required if `content` is not provided.   |
| `filename`         | string        | Varies    | The filename to use for the provided `content`.                           |
| `options.validate_all` | boolean       | `false`   | When using an archive, lint all files instead of just the first one found.|
| `options.exclude_patterns` | string[]      | `[]`      | An array of glob patterns to exclude from linting.                        |
| `options.include_patterns` | string[]      | `[]`      | An array of glob patterns to include in linting.                          |
| `options.log_level`| string        | `'INFO'`  | The log level for the linter process (`DEBUG`, `INFO`, `WARN`, `ERROR`).    |
| `options.timeout`  | number        | `30000`   | The execution timeout in milliseconds.                                    |
| `options.fix`      | boolean       | `false`   | Attempt to automatically fix linting issues if the linter supports it.    |
| `options.config_file`| string        | -         | Path to a custom configuration file within the workspace/archive.         |
| `options.rules`    | object        | `{}`      | A key-value map of linter rules to override.                              |

**Example Request (JSON with Content and Options):**

```bash
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: application/json" \
  -d '{
    "content": "var unused = 42;",
    "filename": "test.js",
    "options": {
      "rules": {
        "no-unused-vars": "error"
      }
    }
  }'
```

**Example Response (`json` format):**

```json
{
  "success": true,
  "exit_code": 1,
  "execution_time_ms": 150,
  "file_count": 1,
  "issues": [
    {
      "file": "test.js",
      "line": 1,
      "column": 5,
      "severity": "error",
      "rule": "no-unused-vars",
      "message": "'unused' is assigned a value but never used."
    }
  ],
  "parsed_output": {}
}
```

### POST /{linter}/{format}/async - Asynchronous Linting

Submits a linting job for background processing, which is ideal for large projects or long-running analyses. The API immediately returns a job ID and a URL to check the status.

The request body and options are identical to the synchronous endpoint.

**Example Request:**

```bash
curl -X POST http://localhost:3000/pylint/json/async \
  -H "Content-Type: application/json" \
  -d '{
    "archive": "<base64-encoded-tar.gz>",
    "options": {
      "validate_all": true
    }
  }'
```

**Example Response:**

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

### GET /{linter}/{format}/{encoded} - Kroki-style Linting

Provides a simple GET endpoint for quick linting, often used for embedding in URLs or simple scripts. The source code is compressed and encoded directly into the URL.

**URL Parameters**

| Parameter | Type   | Description                                                                    |
|-----------|--------|--------------------------------------------------------------------------------|
| `linter`  | string | The name of the linter to use.                                                 |
| `format`  | string | The desired output format (`json`, `text`, or `sarif`).                        |
| `encoded` | string | The source code, first compressed with `DEFLATE` and then encoded with `base64`. |

**Query Parameters**

This endpoint accepts a subset of linter options as query parameters: `validate_all`, `exclude_patterns`, `include_patterns`, `log_level`, `timeout`, `fix`, `config_file`.

**Example Request:**

```bash
# The encoded string represents 'var x=1' compressed and base64 encoded.
curl http://localhost:3000/eslint/json/eJzT00_JTNErKCosLQEAAP-BAn
```

## Asynchronous Job Management

These endpoints are used to track and manage jobs submitted via the asynchronous linting endpoint.

### GET /jobs/{id} - Get Job Status & Results

Retrieves the current status and, if completed, the results of an asynchronous linting job.

**URL Parameters**

| Parameter | Type   | Description             |
|-----------|--------|-------------------------|
| `id`      | string | The ID of the job to check. |

**Example Request:**

```bash
curl http://localhost:3000/jobs/job_1642234567890_abc123
```

**Example Response (Completed):**

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
    "file_count": 10,
    "parsed_output": {}
  }
}
```

**Example Response (Failed):**

```json
{
    "success": true,
    "job_id": "job_1642234567890_abc123",
    "status": "failed",
    "created_at": "2024-01-15T10:30:00.000Z",
    "started_at": "2024-01-15T10:30:05.000Z",
    "completed_at": "2024-01-15T10:30:07.000Z",
    "execution_time_ms": 2000,
    "error": {
        "code": "LINTER_EXECUTION_FAILED",
        "message": "Linter execution timed out after 30000ms",
        "name": "TimeoutError"
    }
}
```

### DELETE /jobs/{id} - Cancel a Job

Cancels a job that is currently in the `pending` or `running` state.

**URL Parameters**

| Parameter | Type   | Description                |
|-----------|--------|----------------------------|
| `id`      | string | The ID of the job to cancel. |

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/jobs/job_1642234567890_abc123
```

**Example Response:**

```json
{
  "success": true,
  "job_id": "job_1642234567890_abc123",
  "status": "cancelled",
  "message": "Job cancelled successfully"
}
```

## Monitoring & Management

Endpoints for monitoring API metrics and managing internal state like the cache.

### GET /metrics - Get API Metrics

Returns performance and usage metrics for the API, including cache statistics, job counts, and system information.

**Example Request:**

```bash
curl http://localhost:3000/metrics
```

**Example Response:**

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
        "linter": "pylint",
        "status": "running",
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
    "platform": "linux",
    "pid": 1234
  }
}
```

### DELETE /cache - Clear Cache

Invalidates and removes all entries from the result cache.

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/cache
```

**Example Response:**

```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "deleted_count": 156
}
```

### GET /cache/stats - Get Cache Statistics

Retrieves detailed statistics about the cache, including size, keys, and hit/miss ratios for the current session.

**Example Request:**

```bash
curl http://localhost:3000/cache/stats
```

**Example Response:**

```json
{
    "success": true,
    "size": 156,
    "keys": 156,
    "hits": 1315,
    "misses": 228,
    "session_stats": {
        "hits": 50,
        "misses": 10,
        "hit_rate": 0.8333
    }
}
```

This concludes the reference for all available API endpoints.