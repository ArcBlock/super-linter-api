# Getting Started

This guide provides the fastest way to get the Super-linter API running on your machine using Docker. In just a few minutes, you'll pull the image, start the container, and make your first linting request to confirm everything is working.

### Prerequisites

Before you begin, ensure you have [Docker](https://www.docker.com/) installed and running on your system.

## Option 1: Run with Docker (Recommended)

This is the simplest and most reliable way to start the API.

### Step 1: Run the API Container

Open your terminal and execute the following command. This will download the latest image from Docker Hub and start it as a background service.

```bash
docker run -d -p 3000:3000 --name linter-api arcblock/super-linter-api:latest
```

This command performs the following actions:
- `docker run`: Starts a new container from an image.
- `-d`: Runs the container in detached mode, meaning it runs in the background.
- `-p 3000:3000`: Maps port 3000 on your local machine to port 3000 inside the container, making the API accessible.
- `--name linter-api`: Assigns a memorable name to the container for easier management (e.g., `docker stop linter-api`).
- `arcblock/super-linter-api:latest`: Specifies the official Docker image and tag to use.

### Step 2: Verify the API is Running

To confirm that the container has started successfully and the API is healthy, send a request to the `/health` endpoint.

```bash
curl http://localhost:3000/health
```

You should receive a JSON response indicating the service is healthy:

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
      "biome",
      "prettier",
      "pylint",
      "flake8",
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

The `