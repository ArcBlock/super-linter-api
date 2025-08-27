# Error Codes

The Super-linter API uses a consistent error format to help you handle issues programmatically. When an API call fails, the response body will contain a JSON object with a standard structure. This page serves as a dictionary for all possible error codes, their meanings, and their corresponding HTTP status codes.

## Standard Error Response

All error responses follow the structure below. The `success` field will always be `false`, and the `error` object will contain the details.

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "A human-readable explanation of the error.",
    "details": {},
    "timestamp": "2024-01-15T10:30:00.000Z",
    "request_id": "req_1642234567890_xyz789"
  }
}
```

- **`code`**: A unique string identifying the error type.
- **`message`**: A clear, human-readable message explaining the error.
- **`details`**: An optional object containing additional context-specific information about the error.
- **`timestamp`**: The ISO 8601 timestamp of when the error occurred.
- **`request_id`**: A unique identifier for the request, useful for logging and support.

## Error Code Reference

The following table lists all possible error codes returned by the API.

| Error Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | The request body or parameters failed validation. The `details` object often contains specifics about the validation failure. |
| `INVALID_PARAMETERS` | 400 | A specific parameter, such as the linter name or format in the URL, is invalid or not supported. |
| `INVALID_CONTENT_ENCODING` | 400 | The content encoding of the request is invalid or not supported. |
| `UNSUPPORTED_FORMAT` | 400 | The requested output format is not supported by the specified linter. |
| `CONTENT_TOO_LARGE` | 413 | The request body or submitted content exceeds the maximum allowed size. |
| `JOB_NOT_FOUND` | 404 | The specified `job_id` does not exist. |
| `NOT_FOUND` | 404 | The requested resource or endpoint could not be found. |
| `TIMEOUT_ERROR` | 408 | The operation exceeded the configured timeout limit before it could complete. |
| `LINTER_NOT_FOUND` | 422 | The requested linter could not be found or is not available in the current environment. |
| `LINTER_EXECUTION_FAILED` | 422 | The linter process started but exited with an error. Check the `details` field for more information like the exit code. |
| `WORKSPACE_ERROR` | 422 | An error occurred while setting up the temporary workspace for the linting job. |
| `JOB_ALREADY_CANCELLED` | 422 | An attempt was made to cancel a job that was already cancelled. |
| `RATE_LIMIT_EXCEEDED` | 429 | The client has sent too many requests in a given amount of time. Check the `X-RateLimit-*` headers for more information. |
| `CACHE_ERROR` | 500 | An internal error occurred while interacting with the caching layer. |
| `DATABASE_ERROR` | 500 | An internal error occurred while interacting with the database for job management. |
| `INTERNAL_SERVER_ERROR` | 500 | A generic, unexpected error occurred on the server. |
| `SERVICE_UNAVAILABLE` | 503 | The service is temporarily unavailable, possibly due to maintenance or overload. |

## Example Error Responses

### Validation Error

This occurs when the request payload is malformed or missing required fields.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed: 'content' is a required field.",
    "details": {
      "missing_field": "content"
    },
    "timestamp": "2024-01-15T10:35:12.123Z",
    "request_id": "req_abc123"
  }
}
```

### Invalid Linter

This occurs when the linter specified in the URL path does not exist.

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

### Linter Execution Failed

This occurs when the linter itself encounters an error while processing the code, such as a syntax error it cannot parse.

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

### Job Not Found

This occurs when querying the status of an asynchronous job with an ID that does not exist.

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Job not found: job_1642234567890_abc123",
    "details": {
        "jobId": "job_1642234567890_abc123"
    },
    "timestamp": "2024-01-15T11:05:30.456Z",
    "request_id": "req_def456"
  }
}
```

### Rate Limit Exceeded

This occurs when you have exceeded the allowed number of requests in the current time window.

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
        "retryAfter": 60
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

By understanding these error codes, you can build more resilient integrations that gracefully handle API failures. Always check the `code` and `details` fields to programmatically respond to different error scenarios.