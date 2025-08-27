# Monitoring

The Super-linter API provides dedicated endpoints to monitor its health, performance, and usage. Integrating these endpoints into your monitoring and alerting systems is crucial for maintaining a reliable service in production. This guide covers the `/health` and `/metrics` endpoints and provides practical examples for their use.

Proper monitoring allows you to set up automated alerts, create performance dashboards, and configure readiness/liveness probes in container orchestrators like Kubernetes.

---

## Health Check Endpoint

The `GET /health` endpoint gives you a real-time snapshot of the API's operational status. It verifies connectivity to essential services like the database and checks the availability of the linters themselves. This endpoint is ideal for automated health checks by load balancers or container orchestration systems.

It returns an HTTP `200 OK` status if all checks pass. If a critical component like the database is unavailable, it will return an HTTP `503 Service Unavailable` status.

### Request

```bash
curl http://localhost:3000/health
```

### Response

A successful response indicates that the core components of the service are functional.

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
      "oxlint",
      "prettier",
      "pylint",
      "flake8",
      "black",
      "shellcheck",
      "golangci-lint",
      "hadolint",
      "yamllint",
      "markdownlint",
      "stylelint"
    ]
  },
  "uptime_ms": 1234567
}
```

### Response Fields

| Key | Type | Description |
|---|---|---|
| `status` | `string` | The overall health status. Can be `healthy` or `degraded`. |
| `timestamp` | `string` | ISO 8601 timestamp of when the health check was performed. |
| `version` | `string` | The current version of the running API service. |
| `environment` | `object` | Contains details about the runtime environment. |
| `checks` | `object` | A breakdown of individual component checks. `true` indicates a healthy component. |
| `linters` | `object` | Statistics on the total and available linters detected by the service. |
| `uptime_ms` | `number` | The total uptime of the service process in milliseconds. |


---

## Performance Metrics Endpoint

The `GET /metrics` endpoint provides a collection of performance and usage statistics. This data is valuable for building dashboards to track trends, understand system load, and plan for capacity. The metrics cover cache performance, job processing, and system resource usage.

### Request

```bash
curl http://localhost:3000/metrics
```

### Response

The response contains several nested objects, each focused on a different aspect of the system.

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
    "platform": "linux",
    "pid": 1
  }
}
```

### Response Fields

#### Cache Metrics

| Key | Type | Description |
|---|---|---|
| `hit_rate_percentage` | `number` | The percentage of requests served from the cache. |
| `total_requests` | `number` | The total number of cache lookups performed. |
| `size_mb` | `number` | The estimated size of the cache on disk in megabytes. |

#### Job Metrics

| Key | Type | Description |
|---|---|---|
| `pending` | `number` | The number of asynchronous jobs currently waiting to be processed. |
| `running` | `number` | The number of jobs actively being processed. |
| `completed_last_24h` | `number` | The count of jobs successfully completed in the last 24 hours. |
| `failed_last_24h` | `number` | The count of jobs that failed in the last 24 hours. |
| `running_jobs` | `array` | A list of job objects for all currently running jobs. |
| `running_count` | `number` | The total number of jobs in the `running` state. |

#### System Metrics

| Key | Type | Description |
|---|---|---|
| `memory_usage` | `object` | An object detailing the Node.js process memory usage in bytes. |
| `node_version` | `string` | The version of the Node.js runtime. |
| `platform` | `string` | The operating system platform (e.g., `linux`, `darwin`). |
| `pid` | `number` | The process ID of the API server. |

---

## Practical Integration Examples

### Kubernetes Liveness and Readiness Probes

You can use the `/health` endpoint to configure probes in a Kubernetes deployment, ensuring traffic is only routed to healthy pods and that failing pods are automatically restarted.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: super-linter-api
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: linter-api
        image: arcblock/super-linter-api:latest
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 20
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
```

This configuration tells Kubernetes to:
- **Readiness Probe**: Wait 15 seconds before the first check. If the `/health` check fails, the pod will be temporarily removed from the service load balancer until it becomes healthy again.
- **Liveness Probe**: Wait 30 seconds before the first check. If the `/health` check fails, Kubernetes will restart the container to attempt recovery.

After setting up your monitoring, learn how to tailor the service's behavior in the [Configuration](./operations-configuration.md) guide.