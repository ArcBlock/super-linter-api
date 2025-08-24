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
    export DEFAULT_WORKSPACE="${DEFAULT_WORKSPACE:-/tmp/lint}"
    
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

# Database initialization
setup_database() {
    log_info "Setting up database..."
    
    # Create data directory if it doesn't exist
    mkdir -p "$(dirname "$DATABASE_PATH")"
    
    # Check if database exists
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

# Super-linter health checks
perform_superlinter_checks() {
    log_info "Performing Super-linter environment health checks..."
    
    # Check Node.js version
    local node_version
    node_version=$(node --version)
    log_info "Node.js version: $node_version"
    
    # Check pnpm version
    local pnpm_version
    pnpm_version=$(pnpm --version)
    log_info "pnpm version: $pnpm_version"
    
    # Check if we're running in Super-linter environment
    if [ "${SUPERLINTER_AVAILABLE:-false}" = "true" ]; then
        log_info "Running in Super-linter environment - checking available linters..."
        
        # Check some key linters that should be available
        local linters_checked=0
        local linters_available=0
        
        # ESLint
        if command -v eslint >/dev/null 2>&1; then
            log_success "✓ ESLint: $(eslint --version)"
            ((linters_available++))
        else
            log_warn "✗ ESLint not found"
        fi
        ((linters_checked++))
        
        # Python linters
        if command -v pylint >/dev/null 2>&1; then
            log_success "✓ Pylint: available"
            ((linters_available++))
        else
            log_warn "✗ Pylint not found"
        fi
        ((linters_checked++))
        
        # ShellCheck
        if command -v shellcheck >/dev/null 2>&1; then
            log_success "✓ ShellCheck: $(shellcheck --version | grep version | head -n1)"
            ((linters_available++))
        else
            log_warn "✗ ShellCheck not found"
        fi
        ((linters_checked++))
        
        # Hadolint (Dockerfile linter)
        if command -v hadolint >/dev/null 2>&1; then
            log_success "✓ Hadolint: available"
            ((linters_available++))
        else
            log_warn "✗ Hadolint not found"
        fi
        ((linters_checked++))
        
        # YAML Lint
        if command -v yamllint >/dev/null 2>&1; then
            log_success "✓ YAMLlint: available"
            ((linters_available++))
        else
            log_warn "✗ YAMLlint not found"
        fi
        ((linters_checked++))
        
        # Black (Python formatter)
        if command -v black >/dev/null 2>&1; then
            log_success "✓ Black: available"
            ((linters_available++))
        else
            log_warn "✗ Black not found"
        fi
        ((linters_checked++))
        
        # Prettier
        if command -v prettier >/dev/null 2>&1; then
            log_success "✓ Prettier: $(prettier --version)"
            ((linters_available++))
        else
            log_warn "✗ Prettier not found"
        fi
        ((linters_checked++))
        
        # Summary
        log_info "Linter availability: $linters_available/$linters_checked linters available"
        
        if [ $linters_available -gt 0 ]; then
            log_success "Super-linter environment verified with $linters_available linters"
        else
            log_warn "No linters found - may be running in non-Super-linter environment"
        fi
    else
        log_info "Running in basic environment - only ESLint support expected"
    fi
    
    # Check workspace directory
    if [ -d "$DEFAULT_WORKSPACE" ]; then
        log_info "Default workspace directory exists: $DEFAULT_WORKSPACE"
    else
        log_info "Creating default workspace directory: $DEFAULT_WORKSPACE"
        mkdir -p "$DEFAULT_WORKSPACE" || log_warn "Could not create workspace directory"
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df -h /app | tail -n1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log_warn "High disk usage: ${disk_usage}%"
    else
        log_info "Disk usage: ${disk_usage}%"
    fi
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

# Main startup sequence
main() {
    log_info "Starting Super-linter API (built on Super-linter base image)..."
    log_info "Container started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    
    # Setup
    setup_signal_handlers
    setup_environment
    setup_database
    perform_superlinter_checks
    
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
        echo "  DEFAULT_WORKSPACE               Workspace directory (default: /tmp/lint)"
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