# Super-linter API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

A comprehensive HTTP API wrapper for code linting that provides **dual-environment support** - works both as a standalone service with basic ESLint support and as a full-featured linting API when built on top of [Super-linter](https://github.com/super-linter/super-linter).

## 🚀 Features

### ⚡ Simplified Setup

- **Single Command Start**: Ready in ~10 seconds with `docker run`
- **Single Directory**: All persistent data in one volume mount
- **Auto-Initialize**: Database schema created automatically
- **Console Logging**: Standard container logging (no custom log files)
- **No Configuration**: Works out-of-the-box with sensible defaults

### Comprehensive Linting Support

- **Complete Integration**: Built on Super-linter base image with 50+ linters pre-installed (18 commonly used ones exposed via API)
- **Production Ready**: Single Docker image that includes all supported linters
- **Dual Operation**: Works as standalone API or embedded in Super-linter workflows

### Supported Linters

This API implements **18 commonly used linters** from Super-linter's 50+ available tools:

- **JavaScript/TypeScript**: ESLint, Prettier, JSHint
- **Python**: Pylint, Flake8, Black, isort, Bandit, MyPy
- **Shell**: ShellCheck
- **Go**: golangci-lint, gofmt
- **Ruby**: RuboCop
- **Docker**: Hadolint
- **YAML**: yamllint
- **JSON**: jsonlint
- **Markdown**: markdownlint
- **CSS**: stylelint

### API Features

- 🔄 **Sync and Async endpoints** for flexible integration
- 📊 **Multiple output formats**: JSON, text, SARIF
- 🏎️ **Built-in caching** with SQLite for improved performance
- 🛡️ **Rate limiting and security headers**
- 📈 **Health checks and metrics**
- 🎯 **Automatic environment detection**
- 📦 **Support for text content and archive uploads**

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [API Usage](#-api-usage)
- [Configuration](#-configuration)
- [Development](#-development)
- [Testing](#-testing)
- [Docker](#-docker)
- [Contributing](#-contributing)
- [Credits](#-credits)
- [License](#-license)

## 🏃 Quick Start

### Using Docker (Recommended)

#### Simple Setup with Persistent Data

```bash
# Create data directory for database and workspace
mkdir -p ./data

# Start with persistent storage (single volume mount)
docker run -d \
  --name super-linter-api \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  arcblock/super-linter-api:latest

# API ready in ~10 seconds!
curl http://localhost:3000/health
```

#### Quick Test (No Persistent Data)

```bash
# For testing - no volume mounts needed
docker run --rm -p 3000:3000 arcblock/super-linter-api:latest
```

#### Pre-built Images (Multi-Registry)

```bash
# From Docker Hub (recommended)
docker pull arcblock/super-linter-api:latest

# From GitHub Container Registry
docker pull ghcr.io/arcblock/super-linter-api:latest
```

### Local Development

```bash
# Install dependencies
npm install -g pnpm
pnpm install

# Start development server
pnpm dev

# The API will be available at http://localhost:3000
```

## 📦 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended) or npm
- **Docker** (for Super-linter mode)

### Standard Installation

```bash
git clone https://github.com/arcblock/super-linter-api.git
cd super-linter-api
pnpm install
pnpm build
pnpm start
```

### Docker Installation

```bash
# Build the Super-linter API image (includes 50+ linters, exposes 18 commonly used ones)
docker build -t arcblock/super-linter-api .
```

## 🔧 API Usage

### Synchronous Linting

```bash
# Lint JavaScript code with ESLint
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: text/plain" \
  -d 'console.log("Hello World");
      var unused = 42;'
```

Response:

```json
{
  "success": true,
  "exit_code": 1,
  "execution_time_ms": 245,
  "file_count": 1,
  "issues": [
    {
      "file": "/tmp/code.js",
      "line": 2,
      "column": 5,
      "rule": "no-unused-vars",
      "severity": "error",
      "message": "'unused' is assigned a value but never used."
    }
  ]
}
```

### Asynchronous Linting

```bash
# Submit async job
curl -X POST http://localhost:3000/eslint/json/async \
  -H "Content-Type: application/json" \
  -d '{
    "content": "console.log(\"Hello World\");",
    "options": {
      "timeout": 30000
    }
  }'

# Response: {"job_id": "job_1234567890_abc123"}

# Check job status
curl http://localhost:3000/jobs/job_1234567890_abc123
```

### Archive Upload

```bash
# Upload tar.gz archive for linting
curl -X POST http://localhost:3000/eslint/json \
  -H "Content-Type: application/json" \
  -d '{
    "archive": "<base64-encoded-tar.gz>",
    "options": {
      "validate_all": true
    }
  }'
```

### Available Endpoints

| Endpoint                        | Method | Description                              |
| ------------------------------- | ------ | ---------------------------------------- |
| `GET /`                         | GET    | API information and available linters    |
| `GET /health`                   | GET    | Health check and system status           |
| `GET /linters`                  | GET    | List all available linters with versions |
| `POST /{linter}/{format}`       | POST   | Synchronous linting                      |
| `POST /{linter}/{format}/async` | POST   | Asynchronous linting                     |
| `GET /jobs/{job_id}`            | GET    | Get job status and results               |
| `DELETE /jobs/{job_id}`         | DELETE | Cancel running job                       |

### Supported Formats

- `json` - Structured JSON output
- `text` - Plain text output
- `sarif` - SARIF format for security tools

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info                # Logs to console only

# Database (auto-initialized)
DATABASE_PATH=/app/data/super-linter-api.db

# Workspace (single directory)
DEFAULT_WORKSPACE=/app/data/workspace

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS (production only)
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Super-linter specific
SUPERLINTER_AVAILABLE=true
RUN_LOCAL=true
```

### Logging

The API uses **console logging only** for compatibility with container orchestration and external logging systems:

```bash
# View logs using docker logs
docker logs super-linter-api

# Follow logs in real-time
docker logs -f super-linter-api

# Last 100 lines with timestamps
docker logs --tail 100 -t super-linter-api
```

Structured JSON logs are output to stdout/stderr and can be captured by:

- Docker's logging drivers
- Kubernetes logging
- Container orchestration platforms
- External logging systems (Fluentd, Logstash, etc.)

### Linter Options

```json
{
  "options": {
    "validate_all": false,
    "exclude_patterns": ["node_modules/**", "*.min.js"],
    "include_patterns": ["src/**/*.js"],
    "log_level": "INFO",
    "timeout": 30000,
    "fix": false,
    "config_file": ".eslintrc.json",
    "rules": {
      "no-console": "warn"
    }
  }
}
```

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/arcblock/super-linter-api.git
cd super-linter-api

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Start development server with hot reload
pnpm build        # Build TypeScript to JavaScript
pnpm start        # Start production server
pnpm test         # Run test suite
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript type checking
```

### Project Structure

```
src/
├── routes/           # API route handlers
├── services/         # Business logic services
│   ├── linter.ts     # Base linter service
│   ├── superLinterRunner.ts  # Super-linter implementation
│   ├── environmentDetector.ts  # Environment detection
│   ├── workspace.ts  # File management
│   ├── cache.ts      # Caching service
│   └── database.ts   # Database operations
├── types/            # TypeScript type definitions
└── server.ts         # Express server setup

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
└── utils/           # Test utilities

docker/
└── Dockerfile  # Super-linter based image with 50+ linters (18 exposed)
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration

# Run specific test file
pnpm test src/services/linter.test.ts
```

### Test Categories

- **Unit Tests**: Individual service and utility testing
- **Integration Tests**: Full API endpoint testing
- **Environment Tests**: Dual-environment behavior verification

## 🐳 Docker

### Production Deployment

```bash
# Create persistent data directory
mkdir -p /opt/super-linter-api/data

# Production deployment with restart policy
docker run -d \
  --name super-linter-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /opt/super-linter-api/data:/app/data \
  -e NODE_ENV=production \
  -e LOG_LEVEL=warn \
  arcblock/super-linter-api:latest
```

### Build from Source

```bash
# Build (requires ~6GB disk space)
docker build -t arcblock/super-linter-api .

# Run with 18 exposed linters (50+ available in base image)
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data arcblock/super-linter-api
```

### Docker Compose

```yaml
version: '3.8'
services:
  super-linter-api:
    image: arcblock/super-linter-api:latest
    container_name: super-linter-api
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      # Single volume for all persistent data
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### Data Directory Structure

With the single volume mount, your data directory will contain:

```
./data/
├── super-linter-api.db    # SQLite database (cache, jobs, metrics)
└── workspace/             # Temporary workspace for linting operations
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Coding Standards

- Follow TypeScript best practices
- Maintain test coverage above 80%
- Use conventional commit messages
- Update documentation for new features

## 🙏 Credits

This project is built on top of and inspired by the excellent work of:

- **[Super-linter](https://github.com/super-linter/super-linter)** - The amazing multi-language linter that powers our Super-linter mode. Super-linter is a comprehensive solution that combines multiple linting tools in a single Docker image.
- **[ESLint](https://eslint.org/)** - JavaScript and TypeScript linting
- **[Express.js](https://expressjs.com/)** - Web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript

### Special Thanks

- The [Super-linter team](https://github.com/super-linter/super-linter/graphs/contributors) for creating and maintaining such a powerful and comprehensive linting solution
- All the individual linter maintainers whose tools are integrated into Super-linter
- The open source community for continuous improvements and feedback

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📋 Future Enhancements (TODO)

### Additional Super-linter Languages Not Yet Implemented

This API currently implements the most commonly used linters from Super-linter. The following languages and tools are available in Super-linter but not yet implemented in this API:

#### Infrastructure & DevOps

- **Ansible**: `ansible-lint`
- **AWS CloudFormation**: `cfn-lint`, `checkov`, `trivy`
- **Azure ARM Templates**: `arm-ttk`, `checkov`, `trivy`
- **Kubernetes**: `checkov`, `trivy`
- **Terraform**: `terraform validate`, `tflint`, `checkov`, `trivy`
- **Helm Charts**: `checkov`

#### Programming Languages

- **C#/.NET**: `dotnet format`
- **Clojure**: `clj-kondo`
- **CoffeeScript**: `coffeelint`
- **Dart**: `dart analyze`
- **Groovy**: `npm-groovy-lint`
- **Lua**: `luacheck`
- **Perl**: `perlcritic`
- **PowerShell**: `PSScriptAnalyzer`
- **R**: `lintr`
- **Scala**: `scalastyle`

#### Specialized Tools

- **Amazon States Language**: ASL Validator
- **Copy/paste detection**: `jscpd`
- **Commit messages**: `commitlint`
- **EditorConfig**: `editorconfig-checker`
- **Environment files**: `dotenv-linter`
- **GitHub Actions**: `actionlint`, `zizmor`
- **Git merge conflicts**: Built-in checker
- **GoReleaser**: GoReleaser validation
- **Jupyter Notebooks**: `nbqa`
- **LaTeX**: `chktex`
- **Licenses**: `trivy`
- **Natural language**: `textlint`
- **OpenAPI**: `spectral`
- **Protocol Buffers**: `protolint`
- **SQL**: `sqlfluff`
- **TOML**: `taplo`
- **XML**: `xmllint`

> **Note**: These linters are available in the Super-linter base image but not yet exposed through this API. Contributions are welcome to add support for any of these tools!

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/arcblock/super-linter-api/wiki)
- **Issues**: [GitHub Issues](https://github.com/arcblock/super-linter-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/arcblock/super-linter-api/discussions)

---

<div align="center">

**[⬆ Back to Top](#super-linter-api)**

Made with ❤️ by the ArcBlock Team

</div>
