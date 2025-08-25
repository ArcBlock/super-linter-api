#!/bin/bash
set -euo pipefail

# Development script for Super-linter API
# Provides convenient commands for development workflow

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

show_usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Development utilities for Super-linter API

COMMANDS:
    setup               Initial project setup (install deps, create dirs)
    start               Start development server with hot reload
    test                Run test suite with options
    lint                Run linting and formatting
    clean               Clean temporary files and caches
    docker              Docker development commands
    db                  Database management commands
    logs                Show application logs
    health              Check application health
    help                Show this help message

OPTIONS (command-specific):
    --watch             Enable watch mode (for test, lint)
    --coverage          Generate coverage report (for test)
    --fix               Auto-fix issues (for lint)
    --verbose           Verbose output
    --port PORT         Override default port (for start)
    --env ENV           Environment (development/production)

EXAMPLES:
    $0 setup                    # Initial project setup
    $0 start --port 4000        # Start dev server on port 4000
    $0 test --watch --coverage  # Run tests in watch mode with coverage
    $0 lint --fix               # Run linting and auto-fix issues
    $0 docker build standard    # Build standard Docker image
    $0 db migrate               # Run database migrations
    $0 clean all                # Clean all temporary files

EOF
}

check_prerequisites() {
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Install with: npm install -g pnpm"
        exit 1
    fi
    
    # Check if we're in project root
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in project root directory"
        exit 1
    fi
}

setup_project() {
    log_info "Setting up development environment..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install
    
    # Create necessary directories
    local dirs=("data" "tmp" "logs")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    # Initialize database
    log_info "Initializing database..."
    if [[ -f "src/scripts/init-db.js" ]]; then
        node src/scripts/init-db.js
    else
        log_warn "Database initialization script not found"
    fi
    
    # Set up git hooks (if .git exists)
    if [[ -d ".git" ]]; then
        log_info "Setting up git hooks..."
        # Create pre-commit hook
        mkdir -p .git/hooks
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for Super-linter API

echo "Running pre-commit checks..."

# Run linting
if ! pnpm lint; then
    echo "❌ Linting failed"
    exit 1
fi

# Run type checking
if ! pnpm type-check; then
    echo "❌ Type checking failed"
    exit 1
fi

# Run tests
if ! pnpm test; then
    echo "❌ Tests failed"
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF
        chmod +x .git/hooks/pre-commit
        log_success "Git hooks installed"
    fi
    
    log_success "Development environment setup complete!"
    log_info "Run '$0 start' to begin development"
}

start_dev_server() {
    local port="${PORT:-3000}"
    local env="${NODE_ENV:-development}"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port)
                port="$2"
                shift 2
                ;;
            --env)
                env="$2"
                shift 2
                ;;
            --verbose)
                export DEBUG="*"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Starting development server..."
    log_info "Port: $port"
    log_info "Environment: $env"
    
    cd "$PROJECT_ROOT"
    
    # Check if dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        log_warn "Dependencies not installed. Running setup..."
        pnpm install
    fi
    
    # Set environment variables
    export PORT="$port"
    export NODE_ENV="$env"
    export LOG_LEVEL="debug"
    
    # Start development server with hot reload
    pnpm dev
}

run_tests() {
    local watch=false
    local coverage=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --watch)
                watch=true
                shift
                ;;
            --coverage)
                coverage=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    cd "$PROJECT_ROOT"
    
    local test_cmd="pnpm test"
    
    if [[ "$coverage" == "true" ]]; then
        test_cmd="$test_cmd --coverage"
    fi
    
    if [[ "$watch" == "true" ]]; then
        test_cmd="$test_cmd --watch"
    fi
    
    if [[ "$verbose" == "true" ]]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    log_info "Running tests: $test_cmd"
    eval "$test_cmd"
}

run_lint() {
    local fix=false
    local watch=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fix)
                fix=true
                shift
                ;;
            --watch)
                watch=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    cd "$PROJECT_ROOT"
    
    if [[ "$fix" == "true" ]]; then
        log_info "Running linter with auto-fix..."
        pnpm lint:fix
        pnpm format
    else
        log_info "Running linter..."
        pnpm lint
        pnpm type-check
    fi
    
    if [[ "$watch" == "true" ]]; then
        log_info "Starting lint watch mode..."
        # This would require additional setup with chokidar or similar
        log_warn "Lint watch mode not yet implemented"
    fi
}

docker_commands() {
    local subcommand="${1:-help}"
    shift || true
    
    case $subcommand in
        build)
            local type="${1:-all}"
            log_info "Building Docker images: $type"
            "$SCRIPT_DIR/build.sh" -t "$type" "$@"
            ;;
        run)
            local type="${1:-standard}"
            local port="${2:-3000}"
            log_info "Running Docker container: $type on port $port"
            
            if [[ "$type" == "superlinter" ]]; then
                docker run --rm -p "$port:3000" arcblock/super-linter-api:superlinter
            else
                docker run --rm -p "$port:3000" arcblock/super-linter-api:latest
            fi
            ;;
        clean)
            log_info "Cleaning Docker images..."
            docker system prune -f
            docker images | grep "arcblock/super-linter-api" | awk '{print $3}' | xargs docker rmi || true
            ;;
        logs)
            local container_name="${1:-super-linter-api}"
            docker logs -f "$container_name"
            ;;
        *)
            echo "Docker subcommands: build, run, clean, logs"
            ;;
    esac
}

db_commands() {
    local subcommand="${1:-help}"
    shift || true
    
    cd "$PROJECT_ROOT"
    
    case $subcommand in
        migrate)
            log_info "Running database migrations..."
            if [[ -f "src/scripts/migrate.js" ]]; then
                node src/scripts/migrate.js
            else
                log_warn "Migration script not found"
            fi
            ;;
        reset)
            log_info "Resetting database..."
            rm -f data/*.db
            if [[ -f "src/scripts/init-db.js" ]]; then
                node src/scripts/init-db.js
            fi
            log_success "Database reset complete"
            ;;
        backup)
            local backup_name="backup-$(date +%Y%m%d-%H%M%S).db"
            log_info "Creating database backup: $backup_name"
            cp data/super-linter-api.db "data/$backup_name"
            log_success "Backup created: data/$backup_name"
            ;;
        *)
            echo "Database subcommands: migrate, reset, backup"
            ;;
    esac
}

clean_project() {
    local target="${1:-temp}"
    
    cd "$PROJECT_ROOT"
    
    case $target in
        all)
            log_info "Cleaning all temporary files..."
            rm -rf tmp/* logs/* .tmp dist/* coverage/
            rm -f data/*.db-*  # SQLite temp files
            ;;
        temp)
            log_info "Cleaning temporary files..."
            rm -rf tmp/* .tmp
            ;;
        logs)
            log_info "Cleaning log files..."
            rm -rf logs/*
            ;;
        cache)
            log_info "Cleaning caches..."
            rm -rf node_modules/.cache coverage/
            ;;
        dist)
            log_info "Cleaning build output..."
            rm -rf dist/*
            ;;
        *)
            echo "Clean targets: all, temp, logs, cache, dist"
            ;;
    esac
    
    log_success "Cleanup complete"
}

show_logs() {
    local log_type="${1:-app}"
    
    cd "$PROJECT_ROOT"
    
    case $log_type in
        app)
            if [[ -f "logs/app.log" ]]; then
                tail -f logs/app.log
            else
                log_warn "Application log file not found"
                log_info "Start the application to generate logs"
            fi
            ;;
        error)
            if [[ -f "logs/error.log" ]]; then
                tail -f logs/error.log
            else
                log_warn "Error log file not found"
            fi
            ;;
        access)
            if [[ -f "logs/access.log" ]]; then
                tail -f logs/access.log
            else
                log_warn "Access log file not found"
            fi
            ;;
        *)
            echo "Log types: app, error, access"
            ;;
    esac
}

check_health() {
    local port="${1:-3000}"
    local host="${2:-localhost}"
    
    log_info "Checking application health at $host:$port"
    
    if curl -s "http://$host:$port/health" > /dev/null; then
        log_success "Application is healthy"
        curl -s "http://$host:$port/health" | jq .
    else
        log_error "Application health check failed"
        return 1
    fi
}

main() {
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 0
    fi
    
    local command="$1"
    shift
    
    check_prerequisites
    
    case $command in
        setup)
            setup_project "$@"
            ;;
        start)
            start_dev_server "$@"
            ;;
        test)
            run_tests "$@"
            ;;
        lint)
            run_lint "$@"
            ;;
        docker)
            docker_commands "$@"
            ;;
        db)
            db_commands "$@"
            ;;
        clean)
            clean_project "$@"
            ;;
        logs)
            show_logs "$@"
            ;;
        health)
            check_health "$@"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"