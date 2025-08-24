#!/bin/bash
set -euo pipefail

# Docker entrypoint script for Super-linter API
# Handles initialization, environment configuration, and graceful shutdown

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

# Configuration validation and defaults
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Set defaults for environment variables
    export NODE_ENV="${NODE_ENV:-production}"
    export PORT="${PORT:-3000}"
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    export DATABASE_PATH="${DATABASE_PATH:-/app/data/super-linter-api.db}"
    export MAX_CONCURRENT_JOBS="${MAX_CONCURRENT_JOBS:-5}"
    export JOB_TIMEOUT_MS="${JOB_TIMEOUT_MS:-300000}"
    export CACHE_TTL_HOURS="${CACHE_TTL_HOURS:-24}"
    export WORKSPACE_CLEANUP_INTERVAL_MS="${WORKSPACE_CLEANUP_INTERVAL_MS:-3600000}"
    
    # Validate critical environment variables
    if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        log_error "Invalid PORT: $PORT. Must be a number between 1-65535"
        exit 1
    fi
    
    if [[ ! "$LOG_LEVEL" =~ ^(error|warn|info|debug)$ ]]; then
        log_warn "Invalid LOG_LEVEL: $LOG_LEVEL. Using 'info' as default"
        export LOG_LEVEL="info"
    fi
    
    log_success "Environment configured successfully"
    log_info "NODE_ENV: $NODE_ENV"
    log_info "PORT: $PORT"
    log_info "LOG_LEVEL: $LOG_LEVEL"
}

# Database initialization and migration
setup_database() {
    log_info "Setting up database..."
    
    # Create data directory if it doesn't exist
    mkdir -p "$(dirname "$DATABASE_PATH")"
    
    # Check if database exists and is accessible
    if [ -f "$DATABASE_PATH" ]; then
        log_info "Database found at: $DATABASE_PATH"
        
        # Test database connectivity
        if ! sqlite3 "$DATABASE_PATH" "SELECT 1;" >/dev/null 2>&1; then
            log_error "Database exists but is not accessible or corrupted"
            exit 1
        fi
        log_success "Database connectivity test passed"
    else
        log_info "Database not found, will be created on first run"
    fi
}

# System health checks
perform_health_checks() {
    log_info "Performing system health checks..."
    
    # Check Node.js version
    local node_version
    node_version=$(node --version)
    log_info "Node.js version: $node_version"
    
    # Check pnpm version
    local pnpm_version
    pnpm_version=$(pnpm --version)
    log_info "pnpm version: $pnpm_version"
    
    # Check available linters
    log_info "Checking available linters..."
    
    # Check ESLint
    if command -v eslint >/dev/null 2>&1; then
        log_success "ESLint: $(eslint --version)"
    else
        log_warn "ESLint not found"
    fi
    
    # Check Prettier
    if command -v prettier >/dev/null 2>&1; then
        log_success "Prettier: $(prettier --version)"
    else
        log_warn "Prettier not found"
    fi
    
    # Check Python linters
    if command -v pylint >/dev/null 2>&1; then
        log_success "Pylint: $(pylint --version | head -n1)"
    else
        log_warn "Pylint not found"
    fi
    
    # Check ShellCheck
    if command -v shellcheck >/dev/null 2>&1; then
        log_success "ShellCheck: $(shellcheck --version | grep version | head -n1)"
    else
        log_warn "ShellCheck not found"
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df -h /app | tail -n1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log_warn "High disk usage: ${disk_usage}%"
    else
        log_info "Disk usage: ${disk_usage}%"
    fi
    
    # Check memory
    local memory_info
    if command -v free >/dev/null 2>&1; then
        memory_info=$(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')
        log_info "Memory usage: $memory_info"
    fi
}

# Setup cleanup handlers for graceful shutdown
setup_signal_handlers() {
    log_info "Setting up signal handlers for graceful shutdown..."
    
    # Function to handle shutdown
    cleanup_and_exit() {
        local signal=$1
        log_info "Received $signal signal, initiating graceful shutdown..."
        
        # If there's a background process, kill it gracefully
        if [ -n "${API_PID:-}" ]; then
            log_info "Stopping API server (PID: $API_PID)..."
            kill -TERM "$API_PID" 2>/dev/null || true
            
            # Wait for graceful shutdown with timeout
            local timeout=30
            while [ $timeout -gt 0 ] && kill -0 "$API_PID" 2>/dev/null; do
                sleep 1
                ((timeout--))
            done
            
            # Force kill if still running
            if kill -0 "$API_PID" 2>/dev/null; then
                log_warn "Force killing API server..."
                kill -KILL "$API_PID" 2>/dev/null || true
            fi
        fi
        
        log_info "Cleanup completed, exiting..."
        exit 0
    }
    
    # Trap signals for graceful shutdown
    trap 'cleanup_and_exit SIGTERM' TERM
    trap 'cleanup_and_exit SIGINT' INT
}

# Function to check if API is ready
wait_for_api_ready() {
    log_info "Waiting for API to become ready..."
    local timeout=60
    local count=0
    
    while [ $count -lt $timeout ]; do
        if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
            log_success "API is ready and responding to health checks"
            return 0
        fi
        
        sleep 1
        ((count++))
        
        # Log progress every 10 seconds
        if [ $((count % 10)) -eq 0 ]; then
            log_info "Still waiting for API... ($count/${timeout}s)"
        fi
    done
    
    log_error "API failed to become ready within ${timeout} seconds"
    return 1
}

# Main startup sequence
main() {
    log_info "Starting Super-linter API container..."
    log_info "Container started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    
    # Setup
    setup_signal_handlers
    setup_environment
    setup_database
    perform_health_checks
    
    log_info "Initialization completed successfully"
    log_info "Starting Super-linter API server..."
    
    # Check if we need to run database migration first
    if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
        log_info "Running database migrations..."
        if [ -f "scripts/schema.sql" ]; then
            log_info "Using schema.sql for database initialization..."
            sqlite3 "$DATABASE_PATH" < scripts/schema.sql
        else
            log_error "No migration script found"
            exit 1
        fi
        log_success "Database migrations completed"
    fi
    
    # Start the API server
    if [ "$#" -eq 0 ] || [ "$1" = "pnpm" ]; then
        # Default startup - run the API server
        exec pnpm start
    else
        # Custom command passed
        log_info "Running custom command: $*"
        exec "$@"
    fi
}

# Handle special cases
case "${1:-}" in
    --help|-h)
        echo "Super-linter API Docker Entrypoint"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (default)     Start the Super-linter API server"
        echo "  bash          Start an interactive bash shell"
        echo "  sh            Start an interactive shell"
        echo "  test          Run the test suite"
        echo "  --version     Show version information"
        echo "  --health      Run health checks only"
        echo ""
        echo "Environment Variables:"
        echo "  NODE_ENV                         Node environment (default: production)"
        echo "  PORT                            Server port (default: 3000)"
        echo "  LOG_LEVEL                       Logging level (default: info)"
        echo "  DATABASE_PATH                   SQLite database path"
        echo "  RUN_MIGRATIONS                  Run DB migrations on startup (default: false)"
        echo "  MAX_CONCURRENT_JOBS             Max concurrent linting jobs (default: 5)"
        echo "  JOB_TIMEOUT_MS                  Job timeout in milliseconds (default: 300000)"
        echo ""
        exit 0
        ;;
    --version)
        echo "Super-linter API $(node -p "require('./package.json').version")"
        echo "Node.js $(node --version)"
        echo "pnpm $(pnpm --version)"
        exit 0
        ;;
    --health)
        setup_environment
        perform_health_checks
        exit 0
        ;;
    test)
        log_info "Running test suite..."
        pnpm test
        exit $?
        ;;
    bash|sh)
        log_info "Starting interactive shell..."
        exec "$1"
        ;;
esac

# Run main function
main "$@"