# Getting Started

This guide provides the fastest way to get the Super-linter API running on your local machine using Docker. You'll pull the image, start the container, and make your first linting request in just a few minutes.

## Prerequisites

Before you begin, ensure you have [Docker](https://www.docker.com/) installed and running on your system.

## Step 1: Run the API with Docker

Open your terminal and run the following command to download and start the Super-linter API container. The first run might take a moment to pull the image from Docker Hub.

```bash
docker run -d -p 3000:3000 --name linter-api arcblock/super-linter-api:latest
```

This command does the following:
- `docker run`: Starts a new container.
- `-d`: Runs the container in detached mode (in the background).
- `-p 3000:3000`: Maps port 3000 on your host machine to port 3000 inside the container.
- `--name linter-api`: Assigns a convenient name to the container for easier management.
- `arcblock/super-linter-api:latest`: Specifies the Docker image to use.

## Step 2: Verify the API is Running

Once the container is running, you can check its health with a simple `curl` request to the `/health` endpoint.

```bash
curl http://localhost:3000/health
```

You should receive a response confirming that the service is healthy:

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
      "biome-lint",
      "prettier",
      "pylint",
      "flake8",
      "black",
      "isort",
      "mypy",
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

The key field here is `"status": "healthy"`. If you see this, the API is ready to accept requests.

## Step 3: Make Your First Linting Request

Now, let's send a snippet of JavaScript code to the `eslint` linter to see it in action. The following command sends a string containing an unused variable.

```bash
curl -X POST http://localhost:3000/eslint/json \
  -d "console.log('Hello'); var unused = 42;"
```

The API will process the code and return a JSON response detailing any issues found. The `no-unused-vars` error confirms that the linter is working correctly.

**Response:**

```json
{
  "success": true,
  "execution_time_ms": 245,
  "issues": [
    {
      "file": "demo.js",
      "line": 1,
      "rule": "no-unused-vars",
      "severity": "error",
      "message": "'unused' is assigned a value but never used."
    }
  ]
}
```

## Next Steps

Congratulations, you have successfully set up and tested the Super-linter API. Now you are ready to explore more advanced use cases.

- To learn how to analyze a complete codebase, see the [Lint a Full Project](./guides-lint-project.md) guide.
- For a complete list of all available endpoints and options, consult the [API Reference](./api-reference.md).