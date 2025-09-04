# Supported Linters

This document provides a comprehensive reference for all linters available in the Super-linter API. You can find details on each linter's purpose, supported languages, performance characteristics, and key configuration options.

## Complete Linter Reference Table

Here is a quick overview of all configured linters in the API. For more details on each, see the detailed sections below.

| Linter | Status | Version | Languages | File Extensions | Purpose | Performance |
|---|---|---|---|---|---|---|
| **biome** | ✅ Available | 2.2.2 | JavaScript, TypeScript, JSON | `.js`, `.jsx`, `.ts`, `.tsx`, `.json` | All-in-one formatting & linting | 🚀🚀🚀 Ultra-fast |
| **biome-lint** | ✅ Available | 2.2.2 | JavaScript, TypeScript, JSON | `.js`, `.jsx`, `.ts`, `.tsx`, `.json` | Comprehensive linting | 🚀🚀🚀 Ultra-fast |
| **black** | ✅ Available | 23.3.0 | Python | `.py` | Code formatting | 🚀🚀 Fast |
| **eslint** | ✅ Available | 8.38.0 | JavaScript, TypeScript, Vue | `.js`, `.jsx`, `.ts`, `.tsx`, `.vue` | Traditional comprehensive linting | 🐢 Slower |
| **flake8** | ✅ Available | 6.0.0 | Python | `.py` | Style guide enforcement | 🚀 Moderate |
| **gofmt** | ✅ Available | 1.19.8 | Go | `.go` | Go code formatting | 🚀🚀🚀 Ultra-fast |
| **golangci-lint** | ✅ Available | 1.52.2 | Go | `.go` | Comprehensive Go linting | 🚀🚀 Fast |
| **hadolint** | ✅ Available | 2.12.1 | Docker | `Dockerfile`, `.dockerfile` | Dockerfile best practices | 🚀🚀 Fast |
| **isort** | ✅ Available | 5.12.0 | Python | `.py` | Import sorting | 🚀🚀🚀 Ultra-fast |
| **markdownlint** | ✅ Available | 0.33.0 | Markdown | `.md` | Markdown style & syntax | 🚀🚀 Fast |
| **mypy** | ✅ Available | 1.2.0 | Python | `.py` | Static type checking | 🐌 Slower |
| **oxlint** | ✅ Available | 1.13.0 | JavaScript, TypeScript | `.js`, `.jsx`, `.ts`, `.tsx` | Ultra-fast linting | 🚀🚀🚀 Ultra-fast |
| **prettier** | ✅ Available | 2.8.7 | JS, TS, JSON, MD, CSS | `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.md`, `.css` | Code formatting | 🐌 Slower |
| **pylint** | ✅ Available | 2.17.2 | Python | `.py` | Comprehensive analysis | 🐢 Slower |
| **rubocop** | ✅ Available | 1.49.0 | Ruby | `.rb`, `.rake`, `.gemfile` | Ruby style guide enforcement | 🚀🚀 Fast |
| **shellcheck** | ✅ Available | 0.9.0 | Shell Scripts | `.sh`, `.bash`, `.dash`, `.ksh` | Shell script analysis | 🚀🚀 Fast |
| **stylelint** | ✅ Available | 15.5.0 | CSS, SCSS, Sass | `.css`, `.scss`, `.sass` | CSS linting | 🚀🚀 Fast |
| **yamllint** | ✅ Available | 1.30.0 | YAML | `.yml`, `.yaml` | YAML validation | 🚀🚀 Fast |
| **bandit** | ❌ Not Available | - | Python | `.py` | Security analysis | - |
| **jshint** | ❌ Not Available | - | JavaScript | `.js` | JavaScript quality tool | - |
| **jsonlint** | ❌ Not Available | - | JSON | `.json` | JSON validation | - |

## Linters by Language

Find the right tool for your codebase with this quick language reference.

- **JavaScript/TypeScript**: `biome`, `biome-lint`, `eslint`, `oxlint`, `prettier`
- **Python**: `black`, `flake8`, `isort`, `mypy`, `pylint`
- **Go**: `gofmt`, `golangci-lint`
- **Ruby**: `rubocop`
- **Shell**: `shellcheck`
- **Docker**: `hadolint`
- **YAML**: `yamllint`
- **Markdown**: `markdownlint`
- **CSS/SCSS**: `stylelint`

## Detailed Linter Information

### JavaScript/TypeScript Linters

#### Biome
- **Purpose**: An all-in-one tool for formatting and linting JavaScript, TypeScript, and JSON.
- **Best for**: Modern projects that benefit from a single, ultra-fast tool for code quality.

| Detail | Value |
|---|---|
| **API Endpoints** | `/biome/json` (format), `/biome-lint/json` (lint) |
| **Fix Support** | ✅ Yes |
| **Config Files** | `biome.json`, `biome.jsonc` |
| **Supported Extensions** | `.js`, `.jsx`, `.ts`, `.tsx`, `.json` |

#### ESLint
- **Purpose**: The traditional, highly-configurable linter for JavaScript and TypeScript.
- **Best for**: Legacy projects or teams that require extensive custom rule configurations and a large plugin ecosystem.

| Detail | Value |
|---|---|
| **API Endpoint** | `/eslint/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yml` |
| **Supported Extensions** | `.js`, `.jsx`, `.ts`, `.tsx`, `.vue` |

#### Oxlint
- **Purpose**: An extremely fast linter for JavaScript and TypeScript, designed for performance.
- **Best for**: Integration into CI/CD pipelines or providing real-time feedback where speed is critical.

| Detail | Value |
|---|---|
| **API Endpoint** | `/oxlint/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.oxlintrc.json`, `oxlint.json` |
| **Supported Extensions** | `.js`, `.jsx`, `.ts`, `.tsx` |

#### Prettier
- **Purpose**: An opinionated code formatter that supports multiple languages.
- **Best for**: Enforcing a consistent code style across projects and languages without extensive configuration.

| Detail | Value |
|---|---|
| **API Endpoint** | `/prettier/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.prettierrc`, `.prettierrc.json`, `.prettierrc.yml` |
| **Supported Extensions** | `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.md`, `.css` |

### Python Linters

#### Black
- **Purpose**: An uncompromising, opinionated code formatter for Python.
- **Best for**: Teams that want to eliminate debates over code style by adopting a single, consistent format.

| Detail | Value |
|---|---|
| **API Endpoint** | `/black/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `pyproject.toml` |
| **Supported Extensions** | `.py` |

#### Flake8
- **Purpose**: A wrapper around PyFlakes, pycodestyle, and McCabe complexity checker.
- **Best for**: Enforcing PEP 8 compliance and checking for logical errors in Python code.

| Detail | Value |
|---|---|
| **API Endpoint** | `/flake8/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.flake8`, `setup.cfg` |
| **Supported Extensions** | `.py` |

#### isort
- **Purpose**: A utility to sort Python imports alphabetically and automatically separate them into sections.
- **Best for**: Maintaining clean, readable, and organized import statements.

| Detail | Value |
|---|---|
| **API Endpoint** | `/isort/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.isort.cfg` |
| **Supported Extensions** | `.py` |

#### MyPy
- **Purpose**: A static type checker for Python.
- **Best for**: Large, type-safe Python applications where catching type errors before runtime is critical.

| Detail | Value |
|---|---|
| **API Endpoint** | `/mypy/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `mypy.ini`, `pyproject.toml` |
| **Supported Extensions** | `.py` |

#### Pylint
- **Purpose**: A comprehensive static analysis tool that checks for errors, enforces a coding standard, and looks for code smells.
- **Best for**: In-depth code quality assessments and detailed feedback on potential issues.

| Detail | Value |
|---|---|
| **API Endpoint** | `/pylint/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.pylintrc`, `pylint.toml`, `pyproject.toml` |
| **Supported Extensions** | `.py` |

### Go Linters

#### gofmt
- **Purpose**: The standard formatter for Go source code.
- **Best for**: Ensuring all Go code in a project adheres to the canonical Go style.

| Detail | Value |
|---|---|
| **API Endpoint** | `/gofmt/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | N/A |
| **Supported Extensions** | `.go` |

#### golangci-lint
- **Purpose**: A fast Go linters runner that aggregates over 40 different linters into a single tool.
- **Best for**: Comprehensive analysis of Go projects that require a wide range of checks.

| Detail | Value |
|---|---|
| **API Endpoint** | `/golangci-lint/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.golangci.yml`, `.golangci.yaml` |
| **Supported Extensions** | `.go` |

### Other Linters

#### Hadolint (Docker)
- **Purpose**: A linter for Dockerfiles that helps build best-practice and secure images.
- **Best for**: Optimizing container security, size, and build speed.

| Detail | Value |
|---|---|
| **API Endpoint** | `/hadolint/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.hadolint.yaml`, `.hadolint.yml` |
| **Supported Extensions** | `Dockerfile`, `.dockerfile` |

#### markdownlint (Markdown)
- **Purpose**: A style checker and syntax linter for Markdown files.
- **Best for**: Maintaining consistent and high-quality documentation, READMEs, and other Markdown content.

| Detail | Value |
|---|---|
| **API Endpoint** | `/markdownlint/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.markdownlint.json` |
| **Supported Extensions** | `.md` |

#### RuboCop (Ruby)
- **Purpose**: A Ruby static code analyzer and code formatter based on the community Ruby style guide.
- **Best for**: Enforcing consistent style and best practices in Ruby projects.

| Detail | Value |
|---|---|
| **API Endpoint** | `/rubocop/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.rubocop.yml`, `.rubocop.yaml` |
| **Supported Extensions** | `.rb`, `.rake`, `.gemfile` |

#### ShellCheck (Shell)
- **Purpose**: A static analysis tool for shell scripts.
- **Best for**: Improving the quality, portability, and security of Bash and shell scripts.

| Detail | Value |
|---|---|
| **API Endpoint** | `/shellcheck/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.shellcheckrc` |
| **Supported Extensions** | `.sh`, `.bash`, `.dash`, `.ksh` |

#### stylelint (CSS)
- **Purpose**: A linter for CSS, SCSS, and Sass files.
- **Best for**: Enforcing consistent conventions and avoiding errors in stylesheets.

| Detail | Value |
|---|---|
| **API Endpoint** | `/stylelint/json` |
| **Fix Support** | ✅ Yes |
| **Config Files** | `.stylelintrc.json` |
| **Supported Extensions** | `.css`, `.scss`, `.sass` |

#### yamllint (YAML)
- **Purpose**: A linter for YAML files that checks for syntax validity, key duplicates, and cosmetic issues.
- **Best for**: Validating configuration files, such as those for Kubernetes or CI/CD pipelines.

| Detail | Value |
|---|---|
| **API Endpoint** | `/yamllint/json` |
| **Fix Support** | ❌ No |
| **Config Files** | `.yamllint`, `.yamllint.yml` |
| **Supported Extensions** | `.yml`, `.yaml` |

## Performance Guidelines

Choose a linter based on your performance needs, whether for instant feedback in an editor or for thorough checks in a CI pipeline.

- **Ultra-Fast (< 500ms)**: `biome`, `biome-lint`, `oxlint`, `isort`, `gofmt`
- **Fast (500ms - 1s)**: `black`, `golangci-lint`, `hadolint`, `shellcheck`, `stylelint`, `yamllint`, `markdownlint`
- **Moderate (1-3s)**: `flake8`, `prettier`, `rubocop`
- **Slower (3s+)**: `eslint`, `pylint`, `mypy`

## Unavailable Linters

The following linters are defined in the configuration but are not currently available in the base service image:

- **bandit**: Security analysis for Python.
- **jshint**: A quality tool for JavaScript.
- **jsonlint**: A validator for JSON files.

These may be added in future updates. For details on how to make requests to the available linters, please see the [API Endpoints](./api-reference-endpoints.md) reference.