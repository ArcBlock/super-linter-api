# Dockerfile using Super-linter as base image
# This provides all 50+ linters pre-installed and configured

# Stage 1: Build stage for our Node.js API
FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.6.5

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Stage 2: Use Super-linter Slim as runtime base for smaller image size
FROM ghcr.io/github/super-linter:slim-latest AS runtime

# Install Node.js and pnpm on top of Super-linter
USER root

# Install Node.js 20, pnpm, oxlint, biome, Ruby, and runtime dependencies with immediate cleanup
# Preserve gofmt binary during the process
RUN mkdir -p /opt/preserved && \
    cp /usr/lib/go/bin/gofmt /opt/preserved/gofmt 2>/dev/null || cp /usr/bin/gofmt /opt/preserved/gofmt 2>/dev/null || true && \
    apk add --no-cache \
        nodejs \
        npm \
        sqlite \
        curl \
        bash \
        ruby \
        ruby-dev \
    && npm install -g pnpm@10.6.5 oxlint@latest @biomejs/biome@latest \
    && rm -rf /var/cache/apk/* \
              /root/.npm \
              /tmp/* \
    && if [ -f "/opt/preserved/gofmt" ]; then \
        cp /opt/preserved/gofmt /usr/bin/gofmt && \
        chmod +x /usr/bin/gofmt; \
    fi && \
    rm -rf /opt/preserved

# Create app directory
WORKDIR /app

# Copy built application and required files from builder stage in single layer
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/scripts ./scripts

# Install ONLY production dependencies (no devDependencies)
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    rm -rf /root/.pnpm-store /app/.pnpm /tmp/* && \
    # Enhanced cleanup: Remove caches, docs, and temporary files (but preserve Go tools)
    rm -rf /var/cache/apk/* \
           /root/.npm \
           /root/.node-gyp \
           /var/tmp/* \
           /usr/share/man \
           /usr/share/doc \
           /usr/share/info \
           /var/lib/apk/* && \
    # Keep only English locale, remove others
    find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name 'en*' -exec rm -rf {} + 2>/dev/null || true

# Create non-root user and set up directory structure in single layer
RUN addgroup -g 1002 -S apiuser && \
    adduser -S apiuser -u 1002 -G apiuser && \
    mkdir -p data data/workspace && \
    chown -R apiuser:apiuser /app && \
    # Ensure files are readable by group for flexible user mounting
    chmod -R g+r /app && \
    chmod g+x /app /app/dist /app/scripts

# Copy and set permissions for entrypoint script in single operation
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Set default environment variables (static configuration)
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    DATABASE_PATH=/app/data/super-linter-api.db \
    SUPERLINTER_AVAILABLE=true \
    DEFAULT_WORKSPACE=/app/data/workspace

# Expose port (static configuration)
EXPOSE 3000

# Create volume mount points for persistent data
VOLUME ["/app/data"]

# Start as root to handle permissions, entrypoint will switch to apiuser
# USER apiuser

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use custom entrypoint that supports both Super-linter and our API
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["pnpm", "start"]
