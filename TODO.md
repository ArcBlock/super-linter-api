# Super-linter HTTP API Implementation TODO

## Project Overview

Building an embedded HTTP API layer inside Super-linter container to provide
Kroki-style REST endpoints for code linting. This transforms Super-linter from a
CLI-only tool to a service that can be consumed via HTTP requests.

**Technology Stack**: Node.js + TypeScript + Express + SQLite + Docker
**Architecture**: Standalone API server that emulates Super-linter functionality
via child processes (can be adapted to embed within Super-linter later)
**Timeline**: ~4 weeks for complete implementation

---

## Phase 1: Foundation & Setup (Week 1)

### 1.1 Project Structure & Dependencies ✅

- [x] Initialize pnpm project with `pnpm init` in root directory
- [x] Install TypeScript and development dependencies
  ```bash
  pnpm add -D typescript @types/node tsx nodemon
  pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
  pnpm add -D prettier eslint jest @types/jest ts-jest
  ```
- [x] Install production dependencies
  ```bash
  pnpm add express cors helmet compression better-sqlite3
  pnpm add @types/express @types/cors @types/better-sqlite3 -D
  pnpm add zod express-rate-limit winston tar
  ```
- [x] Create TypeScript configuration (`tsconfig.json`)
- [x] Setup ESLint and Prettier configurations
- [x] Create folder structure:
  ```
  super-linter-api/
  ├── src/
  │   ├── routes/
  │   ├── services/
  │   ├── middleware/
  │   ├── types/
  │   └── utils/
  ├── tests/
  ├── scripts/
  ├── data/ (SQLite database files)
  └── tmp/ (temporary workspaces)
  ```

### 1.2 Database Foundation ✅

- [x] Design SQLite database schema for caching and job tracking
- [x] Create database migration scripts
- [x] Implement `DatabaseService` class with sqlite3 CLI integration
- [x] Add database connection management
- [x] Create initial database tables:
  - `lint_results` (caching table)
  - `lint_jobs` (async job tracking)
  - `api_metrics` (usage statistics)

### 1.3 Core Type Definitions ✅

- [x] Define API request/response interfaces
- [x] Create linting configuration types  
- [x] Add error response types
- [x] Define database model types
- [x] Create validation schemas with Zod

**Milestone 1**: ✅ Project structure setup with working TypeScript build

---

## Phase 2: Core API Implementation (Week 2)

### 2.1 Basic Express Server

- [ ] Create main `src/server.ts` with Express setup
- [ ] Add security middleware (helmet, cors, compression)
- [ ] Implement rate limiting with `express-rate-limit`
- [ ] Add request logging and error handling middleware
- [ ] Create health check endpoint (`/health`)
- [ ] Add basic request validation middleware

### 2.2 Workspace Management Service

- [ ] Implement `WorkspaceManager` class
- [ ] Add tar.gz extraction and validation
- [ ] Create workspace creation and cleanup logic
- [ ] Add base64 decoding for Kroki-style requests
- [ ] Implement workspace security checks (size limits, path validation)
- [ ] Add file system error handling

### 2.3 Linter Runner Service

- [ ] Create `LinterRunner` class with child process execution
- [ ] Implement environment variable mapping for Super-linter
- [ ] Add linter type to validation flag mapping
- [ ] Create process timeout and error handling
- [ ] Add stdout/stderr capture and parsing
- [ ] Implement workspace cleanup after execution

### 2.4 Cache Service

- [ ] Implement content-based cache key generation (SHA256)
- [ ] Add cache hit/miss logic with SQLite
- [ ] Create cache TTL and cleanup mechanisms
- [ ] Add cache statistics and monitoring
- [ ] Implement cache invalidation strategies

**Milestone 2**: ✅ Basic API server with workspace processing and caching

---

## Phase 3: API Endpoints & Features (Week 2-3)

### 3.1 Kroki-Style GET Endpoints

- [ ] Implement `GET /{linter}/{format}/{encoded}` endpoints
- [ ] Add deflate + base64 decoding for workspace content
- [ ] Create response formatting for different output formats (json, text,
      sarif)
- [ ] Add query parameter support for options
- [ ] Implement caching for GET requests

### 3.2 Full-Featured POST Endpoints

- [ ] Implement `POST /{linter}/{format}` with JSON payload
- [ ] Add support for binary tar.gz uploads
- [ ] Create comprehensive options handling:
  - `validate_all` flag
  - `exclude_patterns` and `include_patterns`
  - `log_level` configuration
  - `timeout` settings
- [ ] Add request size validation and limits

### 3.3 Async Job Management

- [ ] Implement job queue system with SQLite
- [ ] Create `POST /{linter}/{format}/async` endpoints
- [ ] Add job status tracking (`GET /jobs/{id}`)
- [ ] Implement job cancellation (`DELETE /jobs/{id}`)
- [ ] Add job result retrieval endpoints
- [ ] Create job cleanup and timeout handling

### 3.4 Admin & Utility Endpoints

- [ ] Add linter information endpoint (`GET /linters`)
- [ ] Create metrics endpoint (`GET /metrics`)
- [ ] Implement cache management endpoints
- [ ] Add system status and diagnostics
- [ ] Create admin panel for monitoring (optional)

**Milestone 3**: ✅ Complete API functionality with sync/async processing

---

## Phase 4: Testing & Quality (Week 3)

### 4.1 Unit Testing Setup

- [ ] Configure Jest with TypeScript support
- [ ] Create test utilities and helpers
- [ ] Add test database setup (in-memory SQLite)
- [ ] Create mock workspace generators

### 4.2 Unit Tests

- [ ] Test `DatabaseService` methods (CRUD operations)
- [ ] Test `WorkspaceManager` (extraction, validation, cleanup)
- [ ] Test `LinterRunner` (environment mapping, process execution)
- [ ] Test `CacheService` (key generation, TTL, cleanup)
- [ ] Test utility functions (encoding, hashing, validation)
- [ ] Test middleware components (error handling, validation)

### 4.3 Integration Tests

- [ ] Test complete API workflows (GET and POST endpoints)
- [ ] Test real Super-linter execution with sample codebases
- [ ] Test caching behavior and performance
- [ ] Test error scenarios (timeouts, invalid input, large files)
- [ ] Test rate limiting and security features
- [ ] Test async job processing end-to-end

### 4.4 Performance & Load Testing

- [ ] Create performance benchmarks
- [ ] Test with large codebases (>10MB)
- [ ] Test concurrent request handling
- [ ] Profile memory usage and optimization
- [ ] Test container resource limits
- [ ] Add performance regression tests

**Milestone 4**: ✅ Comprehensive test suite with >90% code coverage

---

## Phase 5: Docker Integration (Week 3-4)

### 5.1 Container Setup

- [ ] Create standalone Dockerfile for the API service
- [ ] Install Node.js and pnpm in container
- [ ] Create multi-stage build for API layer
- [ ] Add API build steps to Docker image
- [ ] Configure production-optimized Node.js setup
- [ ] Add Super-linter dependencies (linters, tools) to container

### 5.2 Container Entrypoint

- [ ] Create `docker-entrypoint.sh` script
- [ ] Add environment variable configuration
- [ ] Create startup logging and diagnostics
- [ ] Add graceful shutdown handling
- [ ] Configure container health checks

### 5.3 Development Environment

- [ ] Create `docker-compose.yml` for development
- [ ] Add hot reload support for development
- [ ] Configure volume mounts for rapid iteration
- [ ] Add development environment variables
- [ ] Create development startup scripts

**Milestone 5**: ✅ Working containerized standalone API service

---

## Phase 6: CI/CD & Deployment (Week 4)

### 6.1 Build Automation

- [ ] Create build script (`scripts/build.sh`)
- [ ] Add development script (`scripts/dev.sh`)
- [ ] Create release script (`scripts/release.sh`)
- [ ] Add package.json scripts for common operations
- [ ] Add pre-commit hooks for linting and testing
- [ ] Configure automated version bumping

### 6.2 GitHub Actions Pipeline

- [ ] Create `.github/workflows/api.yml`
- [ ] Add automated testing on PR and push
- [ ] Configure code coverage reporting
- [ ] Add Docker image building and publishing
- [ ] Create automated security scanning
- [ ] Add performance regression detection

### 6.3 Documentation

- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Write deployment guides (Docker, Kubernetes, docker-compose)
- [ ] Add usage examples and tutorials
- [ ] Create troubleshooting guide
- [ ] Update main Super-linter README with API information

### 6.4 Production Deployment

- [ ] Create Kubernetes deployment manifests
- [ ] Add monitoring and observability setup
- [ ] Configure health checks and readiness probes
- [ ] Add resource limits and scaling policies
- [ ] Create backup and recovery procedures

**Milestone 6**: ✅ Production-ready deployment with full CI/CD pipeline

---

## Phase 7: Production Hardening & Optimization (Week 4+)

### 7.1 Security Hardening

- [ ] Add input sanitization and validation
- [ ] Implement request signing (optional)
- [ ] Add audit logging for security events
- [ ] Configure proper CORS policies
- [ ] Add DDoS protection recommendations
- [ ] Security scanning and vulnerability assessment

### 7.2 Performance Optimization

- [ ] Add connection pooling and keep-alive
- [ ] Implement response compression
- [ ] Add CDN integration for static assets
- [ ] Optimize database queries and indexes
- [ ] Add memory usage optimization
- [ ] Implement graceful degradation under load

### 7.3 Monitoring & Observability

- [ ] Add Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Implement structured logging
- [ ] Add distributed tracing (optional)
- [ ] Create alerting rules and runbooks
- [ ] Add performance monitoring

**Milestone 7**: ✅ Production-hardened service with monitoring

---

## Risk Mitigation & Contingencies

### High-Risk Items

- [ ] **Super-linter script compatibility**: Ensure child process execution
      doesn't break existing functionality
- [ ] **Resource usage**: Monitor container memory/CPU usage with API layer
- [ ] **Security**: Validate all workspace content to prevent code injection
- [ ] **Performance**: Large codebases may hit timeout limits

### Contingency Plans

- [ ] **Fallback mode**: If API fails, container should still work in CLI mode
- [ ] **Resource limits**: Implement hard limits on workspace size and execution
      time
- [ ] **Graceful degradation**: Cache layer should be optional, not required
- [ ] **Rollback strategy**: Maintain separate image tags for CLI-only version

---

## Success Criteria

### Functional Requirements ✅

- [ ] API accepts code via HTTP requests (GET/POST)
- [ ] Supports all existing Super-linter languages and configurations
- [ ] Returns structured results (JSON, text, SARIF formats)
- [ ] Maintains backward compatibility with CLI mode
- [ ] Implements effective caching to improve performance

### Performance Requirements ✅

- [ ] Response time <30s for typical codebases (<1000 files)
- [ ] Support for concurrent requests (at least 10 simultaneous)
- [ ] Container startup time <10s in API mode
- [ ] Memory usage <2GB per request for typical workloads
- [ ] Cache hit ratio >70% for repeated requests

### Operational Requirements ✅

- [ ] 99%+ uptime in production
- [ ] Comprehensive monitoring and alerting
- [ ] Easy deployment and scaling
- [ ] Clear documentation and examples
- [ ] Security hardening and vulnerability management

---

## Post-Launch Roadmap

### Future Enhancements

- [ ] WebSocket support for real-time linting results
- [ ] Plugin system for custom linters
- [ ] Multi-repository batch processing
- [ ] Integration with popular IDEs and editors
- [ ] Machine learning for smart caching and optimization

### Community Features

- [ ] Public API instance (like kroki.io)
- [ ] Rate limiting tiers and quotas
- [ ] API key management
- [ ] Usage analytics and reporting
- [ ] Developer portal and community support

---

**Estimated Total Effort**: 4-6 weeks for complete implementation
**Team Size**: 1-2 developers
**Dependencies**: Must integrate with existing linter tools and configurations
**Success Metric**: API processes >1000 linting requests/day with <5% error rate
