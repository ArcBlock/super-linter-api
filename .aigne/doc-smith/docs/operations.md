# Operations

This section provides the necessary guides for deploying, managing, and monitoring the Super-linter API in a production environment. Following these instructions will help you set up a stable, performant, and observable service.

## Deployment

A reliable deployment is the foundation of any production service. This guide provides step-by-step instructions for deploying the API using common containerization technologies. You will find complete, copy-paste-ready examples for Docker, Docker Compose, and Kubernetes, including configurations for persistent storage to maintain job history and cache data across restarts.

[View Deployment Guide &raquo;](./operations-deployment.md)

## Configuration

The API's behavior can be customized at runtime using environment variables. This allows you to tailor the service to your specific infrastructure and usage patterns without modifying the container image. The configuration guide details all available variables, covering aspects such as rate limiting, logging verbosity, and default workspace paths.

[View Configuration Guide &raquo;](./operations-configuration.md)

## Monitoring

Observability is critical for maintaining service health and understanding usage. The API exposes dedicated endpoints for this purpose. The monitoring guide explains how to use the `/health` endpoint for automated health checks and readiness probes, and how to leverage the `/metrics` endpoint to gather valuable statistics on cache performance, job processing, and system resource usage.

[View Monitoring Guide &raquo;](./operations-monitoring.md)

---

After successfully deploying and configuring your instance, you may want to review the detailed [API Reference](./api-reference.md) to understand all available endpoints and data structures.