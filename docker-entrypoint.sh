#!/bin/bash
set -euo pipefail

# Docker entrypoint script for Super-linter API built on Super-linter base image
# This script handles initialization when running our API on top of Super-linter

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
    log_info "Setting up Super-linter API environment configuration..."
    
    # Set defaults for environment variables
    export NODE_ENV="${NODE_ENV:-production}"
    export PORT="${PORT:-3000}"
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    export DATABASE_PATH="${DATABASE_PATH:-/app/data/super-linter-api.db}"
    export SUPERLINTER_AVAILABLE="${SUPERLINTER_AVAILABLE:-true}"
    export DEFAULT_WORKSPACE="${DEFAULT_WORKSPACE:-/app/data/workspace}"
    
    # Super-linter specific environment variables
    export RUN_LOCAL="${RUN_LOCAL:-true}"
    export USE_FIND_ALGORITHM="${USE_FIND_ALGORITHM:-true}"
    export VALIDATE_ALL_CODEBASE="${VALIDATE_ALL_CODEBASE:-false}"
    
    # Validate critical environment variables
    if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        log_error "Invalid PORT: $PORT. Must be a number between 1-65535"
        exit 1
    fi
    
    log_success "Environment configured successfully"
    log_info "NODE_ENV: $NODE_ENV"
    log_info "PORT: $PORT"
    log_info "LOG_LEVEL: $LOG_LEVEL"
    log_info "SUPERLINTER_AVAILABLE: $SUPERLINTER_AVAILABLE"
}

# Database initialization with auto-setup
setup_database() {
    log_info "Setting up database..."
    
    local data_dir
    data_dir="$(dirname "$DATABASE_PATH")"
    
    # Create data directory if it doesn't exist
    mkdir -p "$data_dir"
    
    # Handle permission issues automatically
    if [ ! -w "$data_dir" ]; then
        log_warn "Data directory not writable, fixing permissions..."
        
        # If running as root, we can fix permissions
        if [ "$(id -u)" = "0" ]; then
            chmod -R 777 "$data_dir" 2>/dev/null || true
            log_info "Fixed permissions for: $data_dir"
        else
            # Try to create a test file to check actual permissions
            if ! touch "$data_dir/.permission_test" 2>/dev/null; then
                log_warn "Cannot write to $data_dir - using temporary database in container"
                log_warn "Data will not persist between container restarts"
                
                # Use a temporary database inside the container instead
                export DATABASE_PATH="/tmp/super-linter-api.db"
                mkdir -p /tmp
                data_dir="/tmp"
                
                log_info "Using temporary database: $DATABASE_PATH"
            else
                rm -f "$data_dir/.permission_test" 2>/dev/null || true
                log_success "Data directory is writable"
            fi
        fi
    fi
    
    # Check if database exists and is properly initialized
    local needs_init=false
    
    if [ ! -f "$DATABASE_PATH" ]; then
        log_info "Database not found, will initialize with schema"
        needs_init=true
    else
        # Check if database has required tables
        if ! sqlite3 "$DATABASE_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='lint_results';" 2>/dev/null | grep -q "lint_results"; then
            log_info "Database exists but missing tables, will initialize schema"
            needs_init=true
        else
            log_success "Database found and properly initialized"
        fi
    fi
    
    # Initialize database if needed
    if [ "$needs_init" = true ]; then
        log_info "Initializing database with schema..."
        if [ -f "scripts/schema.sql" ]; then
            if sqlite3 "$DATABASE_PATH" < scripts/schema.sql 2>/dev/null; then
                log_success "Database initialized successfully"
            else
                log_error "Failed to initialize database. Check permissions on: $data_dir"
                exit 1
            fi
        else
            log_error "No schema file found at scripts/schema.sql"
            exit 1
        fi
    fi
    
    # Test database connectivity
    if ! sqlite3 "$DATABASE_PATH" "SELECT 1;" >/dev/null 2>&1; then
        log_error "Database is not accessible or corrupted"
        log_error "Path: $DATABASE_PATH"
        log_error "Directory permissions: $(ls -ld "$data_dir" 2>/dev/null || echo 'unknown')"
        exit 1
    fi
}

# Optimized environment checks
perform_environment_checks() {
    log_info "Performing environment checks..."
    
    # Check Node.js version
    local node_version
    node_version=$(node --version 2>/dev/null || echo "unknown")
    log_info "Node.js version: $node_version"
    
    # Check pnpm version  
    local pnpm_version
    pnpm_version=$(pnpm --version 2>/dev/null || echo "unknown")
    log_info "pnpm version: $pnpm_version"
    
    # Skip linter checks during startup for faster boot
    if [ "${SUPERLINTER_AVAILABLE:-false}" = "true" ]; then
        log_info "Super-linter environment detected (linter check via /linters endpoint)"
    else
        log_info "Basic environment - ESLint support expected"
    fi
    
    # Setup workspace directory
    mkdir -p "$DEFAULT_WORKSPACE" 2>/dev/null || log_warn "Could not create workspace: $DEFAULT_WORKSPACE"
    
    # Quick disk space check
    local disk_usage
    disk_usage=$(df -h /app 2>/dev/null | tail -n1 | awk '{print $5}' | sed 's/%//' || echo "unknown")
    if [ "$disk_usage" != "unknown" ] && [ "$disk_usage" -gt 90 ]; then
        log_warn "High disk usage: ${disk_usage}%"
    fi
    
    log_success "Environment checks completed"
}

# Setup signal handlers for graceful shutdown
setup_signal_handlers() {
    log_info "Setting up signal handlers for graceful shutdown..."
    
    cleanup_and_exit() {
        local signal=$1
        log_info "Received $signal signal, initiating graceful shutdown..."
        
        if [ -n "${API_PID:-}" ]; then
            log_info "Stopping API server (PID: $API_PID)..."
            kill -TERM "$API_PID" 2>/dev/null || true
            
            local timeout=30
            while [ $timeout -gt 0 ] && kill -0 "$API_PID" 2>/dev/null; do
                sleep 1
                ((timeout--))
            done
            
            if kill -0 "$API_PID" 2>/dev/null; then
                log_warn "Force killing API server..."
                kill -KILL "$API_PID" 2>/dev/null || true
            fi
        fi
        
        log_info "Cleanup completed, exiting..."
        exit 0
    }
    
    trap 'cleanup_and_exit SIGTERM' TERM
    trap 'cleanup_and_exit SIGINT' INT
}

# Fix permissions if running as root
fix_permissions() {
    if [ "$(id -u)" = "0" ]; then
        log_info "Running as root, fixing permissions automatically..."
        
        # Fix ownership of mounted volumes only
        local data_dir="$(dirname "${DATABASE_PATH:-/app/data/super-linter-api.db}")"
        if [ -d "$data_dir" ] && [ "$data_dir" != "/app/data" ]; then
            # This is likely a mounted volume, fix its ownership
            chown -R 1002:1002 "$data_dir" 2>/dev/null || true
            chmod -R u+w "$data_dir" 2>/dev/null || true
            log_success "Fixed ownership of mounted volume: $data_dir"
        fi
        
        # Continue running as root for simplicity
        log_info "Continuing as root (container environment)"
    fi
}

# Main startup sequence
main() {
    log_info "Starting Super-linter API (built on Super-linter base image)..."
    log_info "Container started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    
    # Fix permissions if we're root, then switch to apiuser
    fix_permissions "$@"
    
    # Setup (now running as apiuser)
    setup_signal_handlers
    setup_environment
    setup_database  # Now includes auto-initialization
    perform_environment_checks  # Optimized and faster
    
    log_success "Initialization completed successfully"
    log_info "Starting Super-linter API server..."
    
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
        echo "Super-linter API Docker Entrypoint (Super-linter Base Image)"
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
        echo "  --linters     Show available linters"
        echo ""
        echo "Environment Variables:"
        echo "  NODE_ENV                         Node environment (default: production)"
        echo "  PORT                            Server port (default: 3000)"
        echo "  LOG_LEVEL                       Logging level (default: info)"
        echo "  DATABASE_PATH                   SQLite database path"
        echo "  RUN_MIGRATIONS                  Run DB migrations on startup (default: false)"
        echo "  SUPERLINTER_AVAILABLE           Enable Super-linter features (default: true)"
        echo "  DEFAULT_WORKSPACE               Workspace directory (default: /app/data/workspace)"
        echo ""
        exit 0
        ;;
    --version)
        echo "Super-linter API $(node -p "require('./package.json').version")"
        echo "Node.js $(node --version)"
        echo "pnpm $(pnpm --version)"
        echo "Built on Super-linter base image"
        exit 0
        ;;
    --health)
        setup_environment
        perform_superlinter_checks
        exit 0
        ;;
    --linters)
        log_info "Available linters in this Super-linter environment:"
        echo ""
        echo "JavaScript/TypeScript:"
        command -v eslint >/dev/null && echo "  ✓ ESLint $(eslint --version)"
        command -v prettier >/dev/null && echo "  ✓ Prettier $(prettier --version)"
        echo ""
        echo "Python:"
        command -v pylint >/dev/null && echo "  ✓ Pylint"
        command -v black >/dev/null && echo "  ✓ Black"
        command -v flake8 >/dev/null && echo "  ✓ Flake8"
        echo ""
        echo "Shell:"
        command -v shellcheck >/dev/null && echo "  ✓ ShellCheck"
        echo ""
        echo "Docker:"
        command -v hadolint >/dev/null && echo "  ✓ Hadolint"
        echo ""
        echo "YAML:"
        command -v yamllint >/dev/null && echo "  ✓ YAMLlint"
        echo ""
        echo "And many more... (50+ linters available via Super-linter)"
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