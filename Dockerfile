# Dockerfile using Super-linter as base image
# This provides all 50+ linters pre-installed and configured

# Stage 1: Build stage for our Node.js API
FROM node:20-alpine AS builder

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

# Stage 2: Use Super-linter as runtime base
FROM ghcr.io/super-linter/super-linter:latest AS runtime

# Install Node.js and pnpm on top of Super-linter
USER root

# Install Node.js 20 and pnpm
RUN apk add --no-cache \
    nodejs \
    npm \
    sqlite \
    curl \
    && npm install -g pnpm@10.6.5

# Create app directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts

# Create necessary directories
RUN mkdir -p data tmp logs

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user for running the API (super-linter already has users)
RUN addgroup -g 1002 -S apiuser && \
    adduser -S apiuser -u 1002 -G apiuser && \
    chown -R apiuser:apiuser /app

# Switch to non-root user for security
USER apiuser

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    DATABASE_PATH=/app/data/super-linter-api.db \
    SUPERLINTER_AVAILABLE=true \
    DEFAULT_WORKSPACE=/tmp/lint

# Use custom entrypoint that supports both Super-linter and our API
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["pnpm", "start"]