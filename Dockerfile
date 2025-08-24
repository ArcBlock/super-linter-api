# Multi-stage Dockerfile for Super-linter API
# Stage 1: Build stage with development dependencies
FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm@10.6.5

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Stage 2: Runtime stage with minimal dependencies
FROM node:20-alpine AS runtime

# Install pnpm and common linting tools
RUN apk add --no-cache \
    sqlite \
    bash \
    curl \
    tar \
    gzip \
    && npm install -g pnpm@10.6.5

# Install common linters and tools used by Super-linter
RUN apk add --no-cache \
    # JavaScript/TypeScript linters
    npm \
    # Python linters
    python3 \
    py3-pip \
    # Shell linters
    shellcheck \
    # Additional utilities
    git \
    jq

# Install additional linters via npm (commonly used ones)
RUN npm install -g \
    eslint \
    @typescript-eslint/parser \
    @typescript-eslint/eslint-plugin \
    prettier \
    jshint \
    standard

# Install Python linters via apk (Alpine packages) and pip with override
RUN apk add --no-cache \
    py3-pylint \
    py3-flake8 \
    && pip3 install --break-system-packages --no-cache-dir \
    black \
    isort

# Create non-root user for security
RUN addgroup -g 1001 -S linter && \
    adduser -S linter -u 1001 -G linter

# Set working directory
WORKDIR /app

# Copy package files for production dependencies only
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p data tmp logs && \
    chown -R linter:linter /app

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER linter

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    DATABASE_PATH=/app/data/super-linter-api.db

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["pnpm", "start"]