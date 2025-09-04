# Caching Layer

The Super-linter API incorporates a caching layer to significantly enhance performance and reduce server load. By storing the results of previous linting operations, the API can return responses for identical requests almost instantly, avoiding the need to re-run the linter. This mechanism is particularly effective in CI/CD environments where the same code might be linted multiple times.

The caching strategy relies on generating unique identifiers based on both the content being linted and the specific configuration options used for the request.

## How Caching Works

When a linting request is received, the API follows a simple process to determine if a valid cached result exists. This process involves generating unique hashes for the request's content and options, then querying the cache. If a valid entry is found (a "cache hit"), the stored result is returned immediately. If not (a "cache miss"), the linter proceeds with execution, and the new result is stored in the cache for future requests.

This flow is illustrated below:

```d2
direction: down

"Incoming Lint Request": { shape: rectangle }
"Generate Hashes": { shape: diamond }
"Check Cache": { shape: diamond }
"Execute Linter": { shape: rectangle }
"Store Result in Cache": { shape: rectangle }
"Return Lint Result": { shape: rectangle; style.fill: "#f6ffed" }

"Incoming Lint Request" -> "Generate Hashes"
"Generate Hashes" -> "Check Cache": "Content & Options Hash"
"Check Cache" -> "Execute Linter": "Cache Miss"
"Execute Linter" -> "Store Result in Cache"
"Store Result in Cache" -> "Return Lint Result"
"Check Cache" -> "Return Lint Result": "Cache Hit"
```

## Cache Key Generation

A unique cache key is generated for each unique combination of content, linter, output format, and linter options. This ensures that only identical requests receive a cached response. The key is composed of several parts.

### 1. Content Hash

A `sha256` hash is generated from the file content. This ensures that any change to the content, no matter how small, results in a different hash and triggers a new linting operation.

```typescript
// Method for generating the content hash
import { createHash } from 'crypto';

generateContentHash(content: string | Buffer): string {
  const hash = createHash('sha256');
  if (typeof content === 'string') {
    hash.update(content, 'utf-8');
  } else {
    hash.update(content);
  }
  return hash.digest('hex');
}
```

### 2. Options Hash

To ensure that changes in linter configuration are also reflected in the cache, a second `sha256` hash is generated from the linter options. To create a consistent hash, the options are first normalized: default values are applied, and array properties like `exclude_patterns` are sorted alphabetically.

This normalized object is then stringified with its keys sorted, guaranteeing that two options objects with the same settings but different key or array ordering will produce the identical hash.

```typescript
// Options are normalized to ensure consistent hashing
generateOptionsHash(options: LinterOptions): string {
  const normalized = {
    validate_all: options.validate_all || false,
    exclude_patterns: (options.exclude_patterns || []).sort(),
    include_patterns: (options.include_patterns || []).sort(),
    log_level: options.log_level || 'INFO',
    timeout: options.timeout || 30000,
    fix: options.fix || false,
    config_file: options.config_file || '',
    rules: options.rules || {},
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized, Object.keys(normalized).sort()))
    .digest('hex');
}
```

### 3. Final Cache Key

The final cache key combines the linter type, output format, content hash, and options hash into a single, unique string.

**Format:** `${linter}:${format}:${contentHash}:${optionsHash}`

## Storage and Expiration

The API uses a two-level caching system to balance speed and persistence:

1.  **In-Memory Cache**: A `Map` object provides extremely fast, short-term caching for immediate subsequent requests within the same API process. This is ideal for handling bursts of identical requests.
2.  **Database Cache**: A persistent SQLite database stores cache entries for longer-term use across different processes and application restarts. All new cache entries are written to the database.

A cached result is stored as a `LintResult` object with the following structure:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | A unique identifier for the cache entry. |
| `content_hash` | `string` | The SHA256 hash of the linted content. |
| `linter_type` | `string` | The name of the linter used (e.g., 'eslint'). |
| `options_hash` | `string` | The SHA256 hash of the normalized linter options. |
| `result` | `string` | The JSON string of the linting result. |
| `format` | `string` | The output format of the result. |
| `status` | `string` | The status of the operation ('success', 'error', 'timeout'). |
| `error_message` | `string` | Any error message, if the status is not 'success'. |
| `created_at` | `string` | The ISO 8601 timestamp when the entry was created. |
| `expires_at` | `string` | The ISO 8601 timestamp when the entry expires. |

By default, cache entries expire after 24 hours. This TTL (Time-To-Live) can be configured via the `default_ttl_hours` option in the `CacheOptions`.

## Cache Management

The service provides several methods for managing the cache lifecycle, which are particularly useful for maintenance and operational tasks.

*   **Automatic Cleanup**: A background timer runs periodically to automatically delete expired entries from the database. This prevents the cache from growing indefinitely with stale data and ensures efficient storage usage.

*   **Manual Invalidation**: You can programmatically invalidate parts of the cache using the `invalidate` method. This is useful when linter rules are updated or you need to force a re-lint for specific files. The method allows clearing the cache with different levels of granularity:
    *   By a specific content hash and linter type.
    *   By a specific content hash across all linters.
    *   By a specific linter type across all content.
    *   Clearing the entire cache globally.

*   **Cache Warming**: For high-traffic applications, a `warmCache` method is available to pre-populate the cache with results for common files and configurations. This ensures that initial requests for frequently accessed content are served quickly from the cache.

*   **Performance Monitoring**: The `CacheService` exposes methods to monitor its performance. You can retrieve statistics like total entries, hit rate, and hit/miss counts via `getStats()` and `getPerformanceMetrics()`. This data is valuable for understanding cache effectiveness and tuning its configuration.

---

Understanding the caching layer is key to optimizing your use of the Super-linter API. To see how caching fits into the broader request lifecycle, continue to the [Linting Execution](./concepts-linting-execution.md) section.