# Operations

This section provides the necessary guides for deploying, managing, and monitoring the Super-linter API in a production environment. Following these instructions will help you set up a stable, performant, and observable service.

<x-cards data-columns="3">
  <x-card data-title="Deployment" data-icon="lucide:rocket" data-href="/operations/deployment">
    A reliable deployment is the foundation of any production service. This guide provides step-by-step instructions for deploying the API using Docker, Docker Compose, and Kubernetes, including configurations for persistent storage.
  </x-card>
  <x-card data-title="Configuration" data-icon="lucide:settings" data-href="/operations/configuration">
    The API's behavior can be customized at runtime using environment variables. This allows you to tailor aspects like rate limiting, logging verbosity, and workspace paths to your specific infrastructure.
  </x-card>
  <x-card data-title="Monitoring" data-icon="lucide:activity" data-href="/operations/monitoring">
    Observability is critical for maintaining service health. Learn how to use the /health endpoint for automated health checks and the /metrics endpoint to gather valuable statistics on cache performance, job processing, and system resources.
  </x-card>
</x-cards>

---

After successfully deploying and configuring your instance, you may want to review the detailed [API Reference](./api-reference.md) to understand all available endpoints and data structures.