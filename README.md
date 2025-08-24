# Super-linter API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

A comprehensive HTTP API wrapper for code linting that provides **dual-environment support** - works both as a standalone service with basic ESLint support and as a full-featured linting API when built on top of [Super-linter](https://github.com/super-linter/super-linter).

## 🚀 Features

### Comprehensive Linting Support

- **Complete Integration**: Built on Super-linter base image with all 50+ linters pre-installed
- **Production Ready**: Single Docker image that includes all supported linters
- **Dual Operation**: Works as standalone API or embedded in Super-linter workflows

### Supported Linters

- **JavaScript/TypeScript**: ESLint, Prettier, JSHint
- **Python**: Pylint, Flake8, Black, isort, Bandit, MyPy
- **Shell**: ShellCheck
- **Go**: golangci-lint, gofmt
- **Ruby**: RuboCop
- **Docker**: Hadolint
- **YAML**: yamllint
- **Markdown**: markdownlint
- **CSS**: stylelint
- **PHP**: PHP_CodeSniffer, PHPStan
- **Rust**: rustfmt, Clippy
- **Kotlin**: ktlint
- **HTML**: HTMLHint
- **And more!**

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

```bash
# Build the Super-linter enabled image
docker build -f Dockerfile.superlinter -t super-linter-api .

# Run with full linter support
docker run -p 3000:3000 super-linter-api
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
# Build the Super-linter API image (includes all 50+ linters)
docker build -f Dockerfile.superlinter -t super-linter-api .
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
LOG_LEVEL=info

# Database
DATABASE_PATH=/app/data/super-linter-api.db

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS (production only)
ALLOWED_ORIGINS=https://example.com,https://app.example.com

# Super-linter specific
SUPERLINTER_AVAILABLE=true
DEFAULT_WORKSPACE=/tmp/lint
RUN_LOCAL=true
```

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
└── Dockerfile.superlinter  # Super-linter based image with all 50+ linters
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

### Production Docker Image

```bash
# Build (requires ~6GB disk space)
docker build -f Dockerfile.superlinter -t super-linter-api .

# Run with all 50+ linters
docker run -p 3000:3000 super-linter-api
```

### Docker Compose

```yaml
version: '3.8'
services:
  super-linter-api:
    build:
      context: .
      dockerfile: Dockerfile.superlinter
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
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

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/arcblock/super-linter-api/wiki)
- **Issues**: [GitHub Issues](https://github.com/arcblock/super-linter-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/arcblock/super-linter-api/discussions)

---

<div align="center">

**[⬆ Back to Top](#super-linter-api)**

Made with ❤️ by the Super-linter API team

</div>
