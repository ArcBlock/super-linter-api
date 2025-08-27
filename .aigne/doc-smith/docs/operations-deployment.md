# Deployment

This guide provides instructions for deploying the Super-linter API to a production environment. We cover several common deployment methods, including Docker, Docker Compose, and Kubernetes, with a focus on setting up persistent storage for job data and caching.

For details on customizing your deployment with environment variables, see the [Configuration](./operations-configuration.md) guide.

## Docker

The quickest way to get a production-ready instance running is with a single Docker command. This method includes mounting a volume for persistent storage.

```bash
# Run the container in detached mode with a persistent volume
docker run -d -p 3000:3000 -v "$(pwd)/data:/app/data" --name linter-api arcblock/super-linter-api:latest
```

This command performs the following actions:
- `-d`: Runs the container in the background.
- `-p 3000:3000`: Maps port 3000 on the host to port 3000 in the container.
- `-v "$(pwd)/data:/app/data"`: Mounts a local directory named `data` into the container at `/app/data`. The container is designed to handle this volume gracefully:
    - It creates the host directory if it doesn't exist.
    - It automatically fixes directory permissions.
    - If the volume mount fails, it falls back to using temporary storage inside the container.

To verify the container is running, you can check its health:
```bash
curl http://localhost:3000/health
```

## Docker Compose

For a more declarative and manageable setup, especially in multi-service environments, Docker Compose is recommended. Create a `docker-compose.yml` file with the following content:

```yaml
version: '3.8'
services:
  super-linter-api:
    image: arcblock/super-linter-api:latest
    ports:
      - '3000:3000'
    volumes:
      - './data:/app/data' # Persistent cache & jobs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

Key configuration details:
- **`volumes`**: Mounts the local `./data` directory for persistent storage, just like the Docker example.
- **`restart: unless-stopped`**: Ensures the container restarts automatically unless it is explicitly stopped.
- **`environment`**: Sets `NODE_ENV` to `production` for optimal performance.
- **`healthcheck`**: Configures Docker to periodically check the `/health` endpoint to ensure the service is running correctly.

Start the service by running:
```bash
docker-compose up -d
```

## Kubernetes

For scalable and resilient deployments, you can use Kubernetes. The following is a basic `Deployment` configuration that runs three replicas of the API and includes a liveness probe.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: super-linter-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: super-linter-api
  template:
    metadata:
      labels:
        app: super-linter-api
    spec:
      containers:
        - name: api
          image: arcblock/super-linter-api:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

Key configuration details:
- **`replicas: 3`**: Specifies that Kubernetes should maintain three running instances of the pod for high availability.
- **`livenessProbe`**: Kubernetes will periodically send an HTTP GET request to the `/health` endpoint. If the probe fails, the container will be restarted.

To apply this configuration, save it to a file (e.g., `deployment.yaml`) and run:
```bash
kubectl apply -f deployment.yaml
```

Note that for a complete Kubernetes deployment, you would also need to configure a `Service` to expose the deployment and likely a `PersistentVolume` for storage.

---

With your API deployed, the next step is to configure it to your specific needs. Proceed to the [Configuration](./operations-configuration.md) guide to learn about available environment variables, or learn how to keep an eye on your service in the [Monitoring](./operations-monitoring.md) section.