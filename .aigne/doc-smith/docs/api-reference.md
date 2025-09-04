# API Reference

This section provides a complete technical reference for the Super-linter API. Here you will find detailed information on every endpoint, the data structures used in requests and responses, and a comprehensive list of error codes to help you build robust integrations. Whether you are performing a simple linting task or building a complex CI/CD workflow, this reference is your definitive guide to interacting with the API.

## Architecture Overview

The API is designed to handle both immediate (synchronous) and long-running (asynchronous) linting tasks. Client requests are routed to the appropriate handler, which interacts with linter workers and a shared cache and database for job management and performance optimization.

```d2
direction: down

"Client (CI/CD, SDK, curl)": { 
  shape: rectangle 
}

"Super-linter API": {
    shape: package
    grid-columns: 2

    "Sync Linting": {
        label: "POST /{linter}/{format}"
        shape: rectangle
    }
    "Async Linting": {
        label: "POST /{linter}/{format}/async"
        shape: rectangle
    }
    "Job Management": {
        label: "GET /jobs/{id}"
        shape: rectangle
    }
    "Monitoring": {
        label: "GET /metrics, /health"
        shape: rectangle
    }
}

"Job System": {
    shape: package
    "Job Queue": { shape: queue }
    "Linter Workers": { shape: rectangle }
    "Job Queue" -> "Linter Workers"
}

"Cache & Database": {
    shape: cylinder
}

"Client (CI/CD, SDK, curl)" -> "Super-linter API"

"Super-linter API"."Sync Linting" -> "Cache & Database"
"Super-linter API"."Async Linting" -> "Job System"."Job Queue"
"Job System"."Linter Workers" -> "Cache & Database"
"Super-linter API"."Job Management" -> "Cache & Database"
"Super-linter API"."Monitoring" -> "Cache & Database"
```

## Core Components

Navigate to the detailed sections below to explore the API's components.

<x-cards data-columns="3">
  <x-card data-title="Endpoints" data-icon="lucide:server" data-href="/api-reference/endpoints" data-cta="View Endpoints">
    A comprehensive list of all available API endpoints, detailing their methods, URL parameters, request bodies, and functionality.
  </x-card>
  <x-card data-title="Data Types" data-icon="lucide:database" data-href="/api-reference/data-types" data-cta="View Data Types">
    Reference for all data structures used in API requests and responses, such as LinterOptions, LinterResult, and JobStatus objects.
  </x-card>
  <x-card data-title="Error Codes" data-icon="lucide:shield-alert" data-href="/api-reference/error-codes" data-cta="View Error Codes">
    A dictionary of all possible error codes, their meanings, and the HTTP status they correspond to, ensuring robust error handling.
  </x-card>
</x-cards>

## Base URL

All API requests should be made to the following base URLs:

```
http://localhost:3000    # Local development
https://your-domain.com  # Production deployment
```

## Endpoints at a Glance

Here is a summary of all available endpoints for quick reference.

| Endpoint                        | Method | Description          |
| ------------------------------- | ------ | -------------------- |
| `GET /`                         | GET    | API information      |
| `GET /health`                   | GET    | Health check         |
| `GET /linters`                  | GET    | Available linters    |
| `POST /{linter}/{format}`       | POST   | Synchronous linting  |
| `POST /{linter}/{format}/async` | POST   | Asynchronous linting |
| `GET /jobs/{job_id}`            | GET    | Job status/results   |
| `DELETE /jobs/{job_id}`         | DELETE | Cancel job           |
| `GET /metrics`                  | GET    | API metrics          |
| `DELETE /cache`                 | DELETE | Clear cache          |

---

To begin making requests, proceed to the detailed [Endpoints Reference](./api-reference-endpoints.md).