#!/bin/bash
set -euo pipefail

# Build script for Super-linter API
# This script builds the Super-linter Docker image

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="${VERSION:-$(date +%Y%m%d-%H%M%S)}"

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
Usage: $0 [OPTIONS]

Build Super-linter API Docker image

OPTIONS:
    -v, --version VER   Version tag (default: auto-generated timestamp)
    --push              Push image to registry after build
    --no-cache          Build without using Docker cache
    --skip-tests        Skip running tests before build
    -h, --help          Show this help message

EXAMPLES:
    $0                      # Build Super-linter image
    $0 --push              # Build and push Super-linter image
    $0 --no-cache -v latest # Build without cache, tag as latest
    $0 --skip-tests         # Build without running tests

EOF
}

parse_args() {
    PUSH=false
    NO_CACHE=""
    SKIP_TESTS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            --push)
                PUSH=true
                shift
                ;;
            --no-cache)
                NO_CACHE="--no-cache"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "package.json not found. Are you in the project root?"
        exit 1
    fi
    
    # Check required files
    local required_files=(
        "Dockerfile"
        "src/server.ts"
        "pnpm-lock.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warn "Skipping tests (--skip-tests specified)"
        return
    fi
    
    log_info "Running tests before build..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        pnpm install
    fi
    
    # Run linting
    log_info "Running ESLint..."
    if ! pnpm lint; then
        log_error "Linting failed"
        exit 1
    fi
    
    # Run type checking
    log_info "Running TypeScript type check..."
    if ! pnpm type-check; then
        log_error "Type checking failed"
        exit 1
    fi
    
    # Run tests
    log_info "Running test suite..."
    if ! pnpm test; then
        log_error "Tests failed"
        exit 1
    fi
    
    log_success "All pre-build checks passed"
}

build_superlinter_image() {
    log_info "Building Super-linter Docker image..."
    log_warn "This may take 10-15 minutes and requires ~6GB disk space"
    
    local image_name="super-linter-api:$VERSION"
    local latest_tag="super-linter-api:latest"
    
    cd "$PROJECT_ROOT"
    
    # Use platform flag for compatibility
    local platform_flag=""
    if [[ "$(uname -m)" == "arm64" ]]; then
        platform_flag="--platform linux/amd64"
    fi
    
    if ! docker build $NO_CACHE $platform_flag -f Dockerfile -t "$image_name" -t "$latest_tag" .; then
        log_error "Failed to build Super-linter image"
        return 1
    fi
    
    log_success "Built Super-linter image: $image_name"
    
    # Show image size
    local size=$(docker images --format "table {{.Size}}" "$image_name" | tail -n 1)
    log_info "Image size: $size"
    
    if [[ "$PUSH" == "true" ]]; then
        log_info "Pushing Super-linter image..."
        docker push "$image_name"
        docker push "$latest_tag"
        log_success "Pushed Super-linter image"
    fi
}

cleanup_dangling_images() {
    log_info "Cleaning up dangling images..."
    
    local dangling_images=$(docker images -f "dangling=true" -q)
    if [[ -n "$dangling_images" ]]; then
        docker rmi $dangling_images || true
        log_success "Cleaned up dangling images"
    else
        log_info "No dangling images to clean up"
    fi
}

show_summary() {
    log_info "Build Summary:"
    echo "============================================"
    echo "Version: $VERSION"
    echo "Push to Registry: $PUSH"
    echo "============================================"
    
    log_info "Available images:"
    docker images | grep "super-linter-api" | head -10
    
    log_success "Build completed successfully!"
}

main() {
    parse_args "$@"
    
    log_info "Starting Super-linter API build..."
    log_info "Version: $VERSION"
    
    check_prerequisites
    run_tests
    build_superlinter_image
    
    cleanup_dangling_images
    show_summary
}

# Handle script interruption
trap 'log_error "Build interrupted"; exit 1' INT TERM

main "$@"