# Data Types

This page provides a detailed reference for the data structures used in the Super-linter API's requests and responses. Understanding these objects is essential for building integrations and interpreting API results correctly.

## Core Linting Objects

These objects are fundamental to sending linting requests and receiving results.

### LintRequest

The primary object for submitting a file's content for synchronous linting.

| Property | Type | Description |
|---|---|---|
| `content` | `string` \| `Buffer` | The file content to be linted. |
| `options` | `LinterOptions` | Optional configuration for the linting process. See [LinterOptions](#linteroptions). |

### EncodedLintRequest

Used for submitting larger projects or multiple files as a single base64-encoded archive.

| Property | Type | Description |
|---|---|---|
| `encoded_content` | `string` | The base64-encoded string of the project archive (e.g., .tar.gz). |
| `options` | `LinterOptions` | Optional configuration for the linting process. See [LinterOptions](#linteroptions). |

### LinterOptions

An object to configure the behavior of a specific linter run. These options can be passed in both synchronous and asynchronous requests.

| Property | Type | Description |
|---|---|---|
| `validate_all` | `boolean` | If `true`, lint all files in the provided content/archive, ignoring linter-specific file type checks. |
| `exclude_patterns` | `string[]` | An array of glob patterns to exclude from linting. |
| `include_patterns` | `string[]` | An array of glob patterns to explicitly include in linting. |
| `log_level` | `'DEBUG'` \| `'INFO'` \| `'WARN'` \| `'ERROR'` | Sets the logging verbosity for the linting job. |
| `timeout` | `number` | A timeout in milliseconds for the linter process. |
| `fix` | `boolean` | If `true`, attempts to automatically fix any fixable issues found by the linter. |
| `config_file` | `string` | Path to a specific configuration file to use for the linter. |
| `rules` | `Record<string, any>` | An object representing linter-specific rules to enable, disable, or configure. |

### LintResponse

The standard response object for a completed synchronous linting request.

| Property | Type | Description |
|---|---|---|
| `success` | `boolean` | Indicates whether the linting process completed without fatal errors. This is `true` even if lint issues are found. |
| `linter_type` | `LinterType` | The identifier of the linter that was used. |
| `format` | `OutputFormat` | The output format of the `result` field. |
| `result` | `any` | The parsed output from the linter. The structure depends on the `format`. Often an array of `LinterIssue` objects. |
| `metadata` | `object` | Contains metadata about the execution. |
| `metadata.execution_time_ms` | `number` | Total time taken for the linting job in milliseconds. |
| `metadata.cache_hit` | `boolean` | `true` if the response was served from cache. |
| `metadata.file_count` | `number` | The number of files processed. |
| `metadata.issues_count` | `number` | Total number of issues found. |
| `metadata.warnings_count` | `number` | Total number of warnings found. |
| `metadata.errors_count` | `number` | Total number of errors found. |
| `metadata.timestamp` | `string` | ISO 8601 timestamp of when the response was generated. |
| `error` | `string` | An error message if the linting process itself failed. |

### LinterIssue

A standardized object representing a single issue found by a linter. This is a common structure within the `result` field of a `LintResponse`.

| Property | Type | Description |
|---|---|---|
| `file` | `string` | The path to the file where the issue was found. |
| `line` | `number` | The line number of the issue. |
| `column` | `number` | The column number of the issue. |
| `rule` | `string` | The identifier of the rule that was violated. |
| `severity` | `'error'` \| `'warning'` \| `'info'` | The severity level of the issue. |
| `message` | `string` | A human-readable description of the issue. |
| `source` | `string` | The source code snippet where the issue occurred. |
| `fix` | `object` | An object describing a potential automatic fix. |
| `fix.range` | `[number, number]` | The character range in the source to be replaced. |
| `fix.text` | `string` | The replacement text for the fix. |

## Asynchronous Job Objects

These objects are used for managing long-running, asynchronous linting tasks.

### AsyncLintResponse

The immediate response after submitting an asynchronous request. It confirms that the job has been queued.

| Property | Type | Description |
|---|---|---|
| `job_id` | `string` | A unique identifier for the asynchronous job. Use this ID to check the job's status. |
| `status` | `'pending'` \| `'running'` \| ... | The initial status of the job, typically `pending`. |
| `linter_type` | `LinterType` | The linter requested for this job. |
| `format` | `OutputFormat` | The requested output format. |
| `created_at` | `string` | ISO 8601 timestamp of when the job was created. |
| `estimated_completion` | `string` | An estimated completion time for the job. |

### JobStatusResponse

The object returned when checking an asynchronous job's status. It extends `AsyncLintResponse` with more detail as the job progresses.

| Property | Type | Description |
|---|---|---|
| `job_id` | `string` | The unique identifier for the job. |
| `status` | `'pending'` \| `'running'` \| `'completed'` \| `'failed'` \| `'cancelled'` | The current status of the job. |
| `result` | `any` | The linting result, available only when `status` is `completed`. Structure is the same as in `LintResponse`. |
| `error` | `string` | An error message, available only when `status` is `failed`. |
| `started_at` | `string` | ISO 8601 timestamp of when the job started processing. |
| `completed_at` | `string` | ISO 8601 timestamp of when the job finished. |
| `progress` | `object` | An object detailing the progress of a running job. |
| `progress.current_step` | `string` | A description of the current processing step. |
| `progress.completed_files` | `number` | The number of files already processed. |
| `progress.total_files` | `number` | The total number of files to process. |
| `progress.percentage` | `number` | The completion percentage (0-100). |

## System & Monitoring Objects

These objects provide metadata and status information about the API and available linters.

### LinterInfo

Provides metadata about a single supported linter.

| Property | Type | Description |
|---|---|---|
| `name` | `LinterType` | The unique identifier for the linter. |
| `display_name` | `string` | A user-friendly name for the linter. |
| `description` | `string` | A brief description of the linter's purpose. |
| `supported_formats` | `OutputFormat[]` | An array of output formats supported by this linter. |
| `supported_languages` | `string[]` | An array of programming languages this linter supports. |
| `default_options` | `LinterOptions` | The default options used for this linter. |
| `version` | `string` | The version of the underlying linter tool. |
| `available` | `boolean` | `true` if the linter is currently installed and operational. |

### SystemStatus

A comprehensive overview of the API's current health and operational status.

| Property | Type | Description |
|---|---|---|
| `status` | `'healthy'` \| `'degraded'` \| `'unhealthy'` | The overall system status. |
| `version` | `string` | The current version of the API service. |
| `uptime_ms` | `number` | The system uptime in milliseconds. |
| `database` | `object` | Status of the database and cache. |
| `linters` | `object` | Status of the available linters. |
| `metrics` | `object` | Key performance indicators for the API. |

### HealthCheckResponse

A simple response object from the `/health` endpoint, used for basic service monitoring.

| Property | Type | Description |
|---|---|---|
| `status` | `'healthy'` \| `'degraded'` \| `'unhealthy'` | The overall health status. |
| `timestamp` | `string` | ISO 8601 timestamp of the health check. |
| `version` | `string` | The current version of the API service. |
| `checks` | `object` | Status of individual components. |
| `checks.database` | `boolean` | `true` if the database connection is healthy. |
| `checks.filesystem` | `boolean` | `true` if the workspace filesystem is accessible. |
| `checks.linters` | `boolean` | `true` if the core linter binaries are accessible. |
| `uptime_ms` | `number` | The system uptime in milliseconds. |

### MetricsResponse

Provides detailed performance and usage metrics for the API.

| Property | Type | Description |
|---|---|---|
| `cache` | `object` | Metrics related to the caching layer. |
| `jobs` | `object` | Metrics related to asynchronous jobs. |
| `api` | `object` | Metrics related to API endpoint performance and usage. |

## Common Types & Enums

### LinterType
An enumeration of all supported linter identifiers. Possible values include: `eslint`, `oxlint`, `biome`, `biome-lint`, `prettier`, `jshint`, `pylint`, `flake8`, `black`, `isort`, `bandit`, `mypy`, `shellcheck`, `golangci-lint`, `gofmt`, `rubocop`, `hadolint`, `yamllint`, `jsonlint`, `markdownlint`, `stylelint`.

### OutputFormat
An enumeration of the supported output formats for linting results.

| Value | Description |
|---|---|
| `json` | Structured JSON output, often an array of `LinterIssue` objects. |
| `text` | Plain text output, as generated by the linter's CLI. |
| `sarif` | Static Analysis Results Interchange Format, a standard for analysis results. |

## ErrorResponse

The standard format for API errors, returned with a non-2xx HTTP status code.

| Property | Type | Description |
|---|---|---|
| `success` | `false` | Always `false` for error responses. |
| `error` | `object` | An object containing detailed error information. |
| `error.code` | `string` | A unique code for the error type (e.g., `VALIDATION_ERROR`). |
| `error.message` | `string` | A human-readable description of the error. |
| `error.details` | `any` | Additional details about the error, such as validation failures. |
| `error.timestamp` | `string` | ISO 8601 timestamp of when the error occurred. |
| `error.request_id` | `string` | A unique ID for the request, useful for support and debugging. |

---

Now that you are familiar with the data structures, you can explore the available [Endpoints](./api-reference-endpoints.md). For details on handling API errors, see the [Error Codes](./api-reference-error-codes.md) reference.
