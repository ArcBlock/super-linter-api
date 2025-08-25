#!/bin/bash
set -euo pipefail

# Release script for Super-linter API
# Handles versioning, tagging, and publishing releases

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
Usage: $0 [OPTIONS] VERSION_TYPE

Create a new release of Super-linter API

VERSION_TYPE:
    patch       Increment patch version (1.0.0 -> 1.0.1)
    minor       Increment minor version (1.0.0 -> 1.1.0)
    major       Increment major version (1.0.0 -> 2.0.0)
    VERSION     Specific version (e.g., 1.2.3)

OPTIONS:
    --dry-run           Show what would be done without making changes
    --skip-tests        Skip running tests before release
    --skip-build        Skip building Docker images
    --no-push           Don't push to git remote or registry
    --pre-release       Mark as pre-release (beta, rc, etc.)
    --changelog         Generate changelog automatically
    -h, --help          Show this help message

EXAMPLES:
    $0 patch                    # Release patch version (1.0.0 -> 1.0.1)
    $0 minor --changelog        # Release minor version with changelog
    $0 1.2.0 --dry-run          # Preview release 1.2.0 without changes
    $0 major --pre-release      # Release major pre-release version

PREREQUISITES:
    - Clean git working directory
    - All tests passing
    - Valid package.json with version field
    - Docker installed (for image builds)

EOF
}

parse_args() {
    DRY_RUN=false
    SKIP_TESTS=false
    SKIP_BUILD=false
    NO_PUSH=false
    PRE_RELEASE=false
    GENERATE_CHANGELOG=false
    VERSION_TYPE=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --no-push)
                NO_PUSH=true
                shift
                ;;
            --pre-release)
                PRE_RELEASE=true
                shift
                ;;
            --changelog)
                GENERATE_CHANGELOG=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            patch|minor|major)
                VERSION_TYPE="$1"
                shift
                ;;
            [0-9]*.*)
                VERSION_TYPE="$1"
                shift
                ;;
            *)
                log_error "Unknown argument: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$VERSION_TYPE" ]]; then
        log_error "Version type is required"
        show_usage
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking release prerequisites..."

    cd "$PROJECT_ROOT"

    # Check if in git repository
    if [[ ! -d ".git" ]]; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check for clean working directory
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Git working directory is not clean"
        log_error "Please commit or stash your changes before releasing"
        exit 1
    fi

    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found"
        exit 1
    fi

    # Check if we're on main/master branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        log_warn "Not on main/master branch (current: $current_branch)"
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check for required tools
    local required_tools=("node" "pnpm" "git" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done

    log_success "Prerequisites check passed"
}

get_current_version() {
    jq -r '.version' package.json
}

calculate_new_version() {
    local current_version="$1"
    local version_type="$2"

    case $version_type in
        patch|minor|major)
            # Use npm version to calculate
            echo "$(npm version --no-git-tag-version "$version_type" | tail -1 | sed 's/^v//')"
            ;;
        [0-9]*.*)
            # Direct version specified
            echo "$version_type"
            ;;
        *)
            log_error "Invalid version type: $version_type"
            exit 1
            ;;
    esac
}

update_version() {
    local new_version="$1"

    log_info "Updating version to $new_version"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would update package.json version to $new_version"
        return
    fi

    # Update package.json
    local temp_file=$(mktemp)
    jq ".version = \"$new_version\"" package.json > "$temp_file"
    mv "$temp_file" package.json

    log_success "Updated package.json version to $new_version"
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warn "Skipping tests (--skip-tests specified)"
        return
    fi

    log_info "Running test suite..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run: pnpm test"
        return
    fi

    cd "$PROJECT_ROOT"

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        pnpm install
    fi

    # Run linting
    if ! pnpm lint; then
        log_error "Linting failed"
        exit 1
    fi

    # Run type checking
    if ! pnpm type-check; then
        log_error "Type checking failed"
        exit 1
    fi

    # Run tests
    if ! pnpm test; then
        log_error "Tests failed"
        exit 1
    fi

    log_success "All tests passed"
}

build_images() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warn "Skipping Docker builds (--skip-build specified)"
        return
    fi

    local version="$1"

    log_info "Building Docker images for version $version"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build Docker images with version $version"
        return
    fi

    # Build images with version tag (skip tests since we already ran them)
    "$SCRIPT_DIR/build.sh" -v "$version" --skip-tests

    log_success "Docker images built successfully"
}

generate_changelog() {
    if [[ "$GENERATE_CHANGELOG" == "false" ]]; then
        return
    fi

    local version="$1"
    local changelog_file="CHANGELOG.md"

    log_info "Generating changelog for version $version"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would generate changelog entry for $version"
        return
    fi

    # Get git log since last tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local git_range="${last_tag}..HEAD"
    if [[ -z "$last_tag" ]]; then
        git_range="HEAD"
    fi

    # Create changelog entry
    local changelog_entry="## [$version] - $(date +%Y-%m-%d)

### Added
$(git log $git_range --pretty=format:"- %s" --grep="^feat\|^add" | head -10)

### Changed
$(git log $git_range --pretty=format:"- %s" --grep="^refactor\|^update" | head -10)

### Fixed
$(git log $git_range --pretty=format:"- %s" --grep="^fix\|^bug" | head -10)

"

    # Prepend to changelog file
    if [[ -f "$changelog_file" ]]; then
        local temp_file=$(mktemp)
        echo "$changelog_entry" > "$temp_file"
        cat "$changelog_file" >> "$temp_file"
        mv "$temp_file" "$changelog_file"
    else
        echo "# Changelog

$changelog_entry" > "$changelog_file"
    fi

    log_success "Changelog updated"
}

create_git_tag() {
    local version="$1"
    local tag_name="v$version"

    log_info "Creating git tag $tag_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create git tag $tag_name"
        return
    fi

    # Stage changes
    git add package.json
    if [[ -f "CHANGELOG.md" ]]; then
        git add CHANGELOG.md
    fi

    # Create release commit
    local commit_message="chore: release version $version

🚀 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

    git commit -m "$commit_message"

    # Create tag
    local tag_message="Release version $version"
    if [[ "$PRE_RELEASE" == "true" ]]; then
        tag_message="Pre-release version $version"
    fi

    git tag -a "$tag_name" -m "$tag_message"

    log_success "Created git tag $tag_name"
}

push_release() {
    if [[ "$NO_PUSH" == "true" ]]; then
        log_warn "Skipping push (--no-push specified)"
        return
    fi

    local version="$1"
    local tag_name="v$version"

    log_info "Pushing release to remote..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would push commit and tag $tag_name"
        log_info "[DRY RUN] Would push Docker images"
        return
    fi

    # Push commit and tags
    git push origin HEAD
    git push origin "$tag_name"

    # Push Docker images if they were built
    if [[ "$SKIP_BUILD" == "false" ]]; then
        log_info "Pushing Docker images..."
        docker push "super-linter-api:$version" || true
        docker push "super-linter-api:superlinter-$version" || true

        # Also push latest tags for releases (not pre-releases)
        if [[ "$PRE_RELEASE" == "false" ]]; then
            docker push "super-linter-api:latest" || true
            docker push "super-linter-api:superlinter" || true
        fi
    fi

    log_success "Release pushed successfully"
}

create_github_release() {
    if [[ "$NO_PUSH" == "true" ]]; then
        return
    fi

    local version="$1"
    local tag_name="v$version"

    log_info "Creating GitHub release..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create GitHub release for $tag_name"
        return
    fi

    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        log_warn "GitHub CLI (gh) not found, skipping GitHub release creation"
        log_info "Create release manually at: https://github.com/${{ github.repository }}/releases"
        return
    fi

    # Extract changelog for this version
    local release_notes=""
    if [[ -f "CHANGELOG.md" ]] && [[ "$GENERATE_CHANGELOG" == "true" ]]; then
        release_notes=$(awk "/## \[$version\]/,/## \[.*\]/{if(/## \[.*\]/ && !/## \[$version\]/) exit; print}" CHANGELOG.md | head -n -1)
    else
        release_notes="Release version $version

See the [full changelog](https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^.]*\).*/\1/')/compare/v$(get_current_version)...$tag_name) for details."
    fi

    local gh_flags=""
    if [[ "$PRE_RELEASE" == "true" ]]; then
        gh_flags="--prerelease"
    fi

    echo "$release_notes" | gh release create "$tag_name" $gh_flags --title "Release $version" --notes-file -

    log_success "GitHub release created: $tag_name"
}

show_summary() {
    local current_version="$1"
    local new_version="$2"

    log_info "Release Summary"
    echo "============================================"
    echo "Previous Version: $current_version"
    echo "New Version:      $new_version"
    echo "Version Type:     $VERSION_TYPE"
    echo "Pre-release:      $PRE_RELEASE"
    echo "Dry Run:          $DRY_RUN"
    echo "Skip Tests:       $SKIP_TESTS"
    echo "Skip Build:       $SKIP_BUILD"
    echo "No Push:          $NO_PUSH"
    echo "Generate Changelog: $GENERATE_CHANGELOG"
    echo "============================================"

    if [[ "$DRY_RUN" == "false" ]]; then
        log_success "Release $new_version completed successfully!"
        log_info "Next steps:"
        echo "  - Monitor CI/CD pipeline"
        echo "  - Update documentation if needed"
        echo "  - Announce release to team/users"
    else
        log_info "This was a dry run. No changes were made."
        log_info "Run without --dry-run to execute the release."
    fi
}

main() {
    parse_args "$@"

    log_info "Starting release process..."

    check_prerequisites

    local current_version=$(get_current_version)
    local new_version

    # Calculate new version, but restore original if this is a dry run
    if [[ "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
        # For npm version commands, we need to temporarily update
        if [[ "$DRY_RUN" == "true" ]]; then
            # Create a temporary copy to test version calculation
            local temp_package=$(mktemp)
            cp package.json "$temp_package"
            new_version=$(calculate_new_version "$current_version" "$VERSION_TYPE")
            # Restore original
            mv "$temp_package" package.json
        else
            new_version=$(calculate_new_version "$current_version" "$VERSION_TYPE")
        fi
    else
        new_version="$VERSION_TYPE"
    fi

    log_info "Releasing version $current_version -> $new_version"

    # Confirm release
    if [[ "$DRY_RUN" == "false" ]]; then
        echo -e "\n${YELLOW}About to release version $new_version${NC}"
        read -p "Continue? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Release cancelled"
            exit 0
        fi
    fi

    # Execute release steps
    run_tests
    update_version "$new_version"
    generate_changelog "$new_version"
    build_images "$new_version"
    create_git_tag "$new_version"
    push_release "$new_version"
    create_github_release "$new_version"

    show_summary "$current_version" "$new_version"
}

main "$@"
