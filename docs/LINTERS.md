# Complete Linter Reference

This document provides detailed information about all 21 configured linters in the Super-linter API.

## 📊 **Complete Linter Reference Table**

| Linter | Status | Version | Languages | File Extensions | Purpose | Performance |
|--------|--------|---------|-----------|----------------|---------|-------------|
| **biome** | ✅ Available | 2.2.2 | JavaScript, TypeScript, JSON | `.js`, `.jsx`, `.ts`, `.tsx`, `.json` | All-in-one formatting & linting | 🚀🚀🚀 Ultra-fast |
| **biome-lint** | ✅ Available | 2.2.2 | JavaScript, TypeScript, JSON | `.js`, `.jsx`, `.ts`, `.tsx`, `.json` | Comprehensive linting | 🚀🚀🚀 Ultra-fast |
| **black** | ✅ Available | 23.3.0 | Python | `.py` | Code formatting | 🚀🚀 Fast |
| **eslint** | ✅ Available | 8.38.0 | JavaScript, TypeScript, Vue | `.js`, `.jsx`, `.ts`, `.tsx`, `.vue` | Traditional comprehensive linting | 🐢 Slower |
| **flake8** | ✅ Available | 6.0.0 | Python | `.py` | Style guide enforcement | 🚀 Moderate |
| **golangci-lint** | ✅ Available | 1.52.2 | Go | `.go` | Comprehensive Go linting | 🚀🚀 Fast |
| **hadolint** | ✅ Available | 2.12.1 | Docker | `Dockerfile`, `.dockerfile` | Dockerfile best practices | 🚀🚀 Fast |
| **isort** | ✅ Available | 5.12.0 | Python | `.py` | Import sorting | 🚀🚀🚀 Ultra-fast |
| **markdownlint** | ✅ Available | 0.33.0 | Markdown | `.md` | Markdown style & syntax | 🚀🚀 Fast |
| **mypy** | ✅ Available | 1.2.0 | Python | `.py` | Static type checking | 🐌 Slower |
| **oxlint** | ✅ Available | 1.13.0 | JavaScript, TypeScript | `.js`, `.jsx`, `.ts`, `.tsx` | Ultra-fast linting | 🚀🚀🚀 Ultra-fast |
| **prettier** | ✅ Available | 2.8.7 | JavaScript, TypeScript, JSON, Markdown, CSS | `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.md`, `.css` | Code formatting | 🐌 Slower |
| **pylint** | ✅ Available | 2.17.2 | Python | `.py` | Comprehensive analysis | 🐢 Slower |
| **shellcheck** | ✅ Available | 0.9.0 | Shell Scripts | `.sh`, `.bash`, `.dash`, `.ksh` | Shell script analysis | 🚀🚀 Fast |
| **stylelint** | ✅ Available | 15.5.0 | CSS, SCSS, Sass | `.css`, `.scss`, `.sass` | CSS linting | 🚀🚀 Fast |
| **yamllint** | ✅ Available | 1.30.0 | YAML | `.yml`, `.yaml` | YAML validation | 🚀🚀 Fast |
| **bandit** | ❌ Not Available | - | Python | `.py` | Security analysis | - |
| **gofmt** | ❌ Not Available | - | Go | `.go` | Go formatting | - |
| **jshint** | ❌ Not Available | - | JavaScript | `.js` | JavaScript quality tool | - |
| **jsonlint** | ❌ Not Available | - | JSON | `.json` | JSON validation | - |
| **rubocop** | ❌ Not Available | - | Ruby | `.rb`, `.rake`, `.gemfile` | Ruby style guide | - |

## 🎯 **Quick Language Reference**

- **JavaScript/TypeScript** (5 linters): `biome`, `biome-lint`, `eslint`, `oxlint`, `prettier`
- **Python** (5 linters): `black`, `flake8`, `isort`, `mypy`, `pylint` 
- **Go** (1 linter): `golangci-lint`
- **Shell** (1 linter): `shellcheck`
- **Docker** (1 linter): `hadolint`
- **YAML** (1 linter): `yamllint`
- **Markdown** (1 linter): `markdownlint`
- **CSS/SCSS** (1 linter): `stylelint`
- **Multi-language** (1 linter): `prettier` (JS/TS/JSON/MD/CSS)

## 📈 **Availability Summary**
- **✅ Available**: 16/21 linters (76% coverage)
- **❌ Not Available**: 5/21 linters (missing from Super-linter slim base)

## 🔍 **Detailed Linter Information**

### JavaScript/TypeScript Linters

#### ESLint
- **Purpose**: Traditional comprehensive JavaScript/TypeScript linting
- **Best for**: Legacy projects, custom rule configurations
- **Performance**: ~2-3 seconds for medium files
- **Features**: Extensive rule set, plugin ecosystem, auto-fixing
- **API Usage**: `/eslint/json`

#### Oxlint  
- **Purpose**: Ultra-fast JavaScript/TypeScript linting
- **Best for**: CI/CD pipelines, real-time feedback
- **Performance**: ~150-300ms (5x faster than ESLint)
- **Features**: Essential rules, TypeScript support, minimal config
- **API Usage**: `/oxlint/json`

#### Biome
- **Purpose**: All-in-one formatting and linting
- **Best for**: Modern projects wanting single tool
- **Performance**: ~200-500ms (ultra-fast)
- **Features**: Formatting + linting, TypeScript support, JSON support
- **API Usage**: `/biome/json` (formatting), `/biome-lint/json` (linting)

#### Prettier
- **Purpose**: Code formatting
- **Best for**: Established formatting workflows
- **Performance**: ~500-1000ms (slower)
- **Features**: Multi-language support, opinionated formatting
- **API Usage**: `/prettier/json`

### Python Linters

#### Pylint
- **Purpose**: Comprehensive Python code analysis
- **Best for**: Code quality assessment, detailed feedback
- **Performance**: ~2-5 seconds (thorough analysis)
- **Features**: Extensive checks, code metrics, detailed reports
- **API Usage**: `/pylint/json`

#### Black
- **Purpose**: Python code formatting
- **Best for**: Consistent code style across teams
- **Performance**: ~300-800ms (fast)
- **Features**: Opinionated formatting, minimal configuration
- **API Usage**: `/black/json`

#### MyPy
- **Purpose**: Static type checking for Python
- **Best for**: Type-safe Python development
- **Performance**: ~1-7 seconds (depends on project size)
- **Features**: Type inference, gradual typing, error detection
- **API Usage**: `/mypy/json`

#### isort
- **Purpose**: Python import sorting and organization
- **Best for**: Clean import structure
- **Performance**: ~100-500ms (ultra-fast)
- **Features**: Import grouping, custom sorting, various styles
- **API Usage**: `/isort/json`

#### Flake8
- **Purpose**: Python style guide enforcement
- **Best for**: PEP8 compliance, style consistency
- **Performance**: ~400-1000ms (moderate)
- **Features**: Multiple checkers combined, plugin support
- **API Usage**: `/flake8/json`

### Other Language Linters

#### golangci-lint (Go)
- **Purpose**: Comprehensive Go linting
- **Best for**: Go projects requiring multiple linters
- **Performance**: ~500-2000ms (fast for Go)
- **Features**: 40+ linters combined, configurable, parallel execution
- **API Usage**: `/golangci-lint/json`

#### ShellCheck (Shell)
- **Purpose**: Shell script analysis
- **Best for**: Bash/shell script quality and portability
- **Performance**: ~200-800ms (fast)
- **Features**: Syntax validation, best practice enforcement, security checks
- **API Usage**: `/shellcheck/json`

#### Hadolint (Docker)
- **Purpose**: Dockerfile best practices
- **Best for**: Container security and optimization
- **Performance**: ~100-500ms (fast)
- **Features**: Security rules, layer optimization, best practices
- **API Usage**: `/hadolint/json`

#### yamllint (YAML)
- **Purpose**: YAML file validation and style
- **Best for**: Kubernetes manifests, CI/CD configs
- **Performance**: ~200-600ms (fast)
- **Features**: Syntax validation, style rules, schema validation
- **API Usage**: `/yamllint/json`

#### markdownlint (Markdown)
- **Purpose**: Markdown style and syntax checking
- **Best for**: Documentation quality, README files
- **Performance**: ~300-1000ms (fast)
- **Features**: Style rules, link validation, formatting consistency
- **API Usage**: `/markdownlint/json`

#### stylelint (CSS)
- **Purpose**: CSS/SCSS linting
- **Best for**: Frontend styling standards
- **Performance**: ~300-1000ms (fast)
- **Features**: Modern CSS support, SCSS/Sass support, auto-fixing
- **API Usage**: `/stylelint/json`

## 🚫 **Currently Unavailable Linters**

The following linters are configured but not available in the Super-linter slim base image:

- **bandit**: Python security analysis
- **gofmt**: Go code formatting  
- **jshint**: JavaScript quality tool
- **jsonlint**: JSON validation
- **rubocop**: Ruby style guide enforcement

These may be added in future versions or can be contributed by the community.

## ⚡ **Performance Guidelines**

### Ultra-Fast (< 500ms)
Ideal for real-time feedback, development environments:
- biome, biome-lint, oxlint, isort

### Fast (500ms - 1s)  
Good for CI/CD, automated workflows:
- black, golangci-lint, hadolint, shellcheck, stylelint, yamllint, markdownlint

### Moderate (1-2s)
Suitable for detailed analysis, scheduled checks:
- flake8, prettier

### Slower (2s+)
Best for comprehensive analysis, code quality gates:
- eslint, pylint, mypy

## 🔧 **Configuration Examples**

### Basic Linting
```bash
curl -X POST http://localhost:3000/eslint/json \
  -d '{"content": "console.log(\"hello\");", "filename": "test.js"}'
```

### With Options
```bash
curl -X POST http://localhost:3000/pylint/json \
  -d '{
    "content": "import os\\nprint(\"hello\")",
    "filename": "test.py",
    "options": {
      "timeout": 10000,
      "log_level": "INFO"
    }
  }'
```

### Multi-file Project
```bash
curl -X POST http://localhost:3000/eslint/json \
  -d '{
    "archive": "<base64-encoded-tar-gz>",
    "options": {
      "validate_all": true,
      "exclude_patterns": ["node_modules/**", "dist/**"]
    }
  }'
```

---

*This documentation is automatically updated based on the live API status. Last updated: $(date).*