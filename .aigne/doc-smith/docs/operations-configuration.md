# Configuration

The Super-linter API is configured using environment variables. This allows you to adapt the service's behavior to different environments (development, staging, production) without changing the code. You can control aspects such as the server port, logging verbosity, and rate limiting policies.

## Key Configuration Variables

Below is a comprehensive list of the environment variables used to configure the application.

| Variable                  | Description                                                                 | Default Value                                   |
| ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| `PORT`                    | The network port on which the server will listen for incoming requests.       | `3000`                                          |
| `NODE_ENV`                | The application's operating environment. Affects logging and rate limits.   | `development`                                   |
| `LOG_LEVEL`               | Sets the minimum level for logs to be recorded (e.g., `debug`, `info`, `warn`). | `info`                                          |
| `DEFAULT_WORKSPACE`       | The base directory for creating temporary workspaces for linting jobs.      | The operating system's default temporary directory. |
| `RATE_LIMIT_WINDOW_MS`    | The time window for the rate limiter in milliseconds.                       | `900000` (15 minutes)                           |
| `RATE_LIMIT_MAX_REQUESTS` | The maximum number of requests allowed per IP address within the time window. | `100` (for `production`), `1000` (for `development`) |
| `RATE_LIMIT_MESSAGE`      | The custom message returned to the client when the rate limit is exceeded.  | `Too many requests, please try again later`     |

## How to Apply Configuration

You can set these variables using various methods depending on your deployment strategy.

### Example: Docker CLI

When running the service directly with Docker, you can pass environment variables using the `-e` flag.

```bash
docker run -d -p 8080:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e LOG_LEVEL=warn \
  -e RATE_LIMIT_MAX_REQUESTS=250 \
  arcblock/super-linter-api:latest
```
This command starts the API in `production` mode on port 3000 (exposed on the host as port 8080), sets the log level to `warn`, and allows 250 requests per 15 minutes.

### Example: Docker Compose

For a more declarative setup, you can define the environment variables in your `docker-compose.yml` file.

```yaml
version: '3.8'
services:
  super-linter-api:
    image: arcblock/super-linter-api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - RATE_LIMIT_WINDOW_MS=60000
      - RATE_LIMIT_MAX_REQUESTS=100
```
This configuration starts the service in production mode and configures the rate limiter to allow 100 requests per minute.

---

With the service configured, the next step is to monitor its health and performance. Proceed to the [Monitoring](./operations-monitoring.md) guide to learn how to use the health and metrics endpoints.