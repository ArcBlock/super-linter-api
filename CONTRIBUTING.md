# Contributing to Super-linter API

🎉 Thank you for your interest in contributing to Super-linter API! This guide will help you get started.

## 🚀 Quick Start for Contributors

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended) or npm
- **Docker** (for full linter testing)
- **Git** for version control

### Development Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/super-linter-api.git
cd super-linter-api

# 3. Install dependencies
pnpm install

# 4. Start development server
pnpm dev

# 5. Verify everything works
curl http://localhost:3000/health
```

## 📋 Development Workflow

### 1. **Choose an Issue**

- Browse [open issues](https://github.com/arcblock/super-linter-api/issues)
- Look for `good first issue` or `help wanted` labels
- Comment on the issue to claim it

### 2. **Create a Branch**

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. **Make Your Changes**

- Follow our [coding standards](#-coding-standards)
- Write tests for new functionality
- Update documentation if needed

### 4. **Test Your Changes**

```bash
# Run all tests
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm type-check

# Test specific linter (requires Docker)
pnpm test:integration
```

### 5. **Commit Your Changes**

```bash
git add .
git commit -m "feat: add support for new linter"
# or
git commit -m "fix: resolve issue with cache invalidation"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 6. **Submit a Pull Request**

```bash
git push origin your-branch-name
```

Then create a PR on GitHub with:

- Clear description of changes
- Reference any related issues
- Include screenshots/demos if relevant

## 🎯 Areas for Contribution

### 🔧 **Easy Contributions**

- **Documentation**: Improve README, add examples, fix typos
- **Tests**: Add test cases for existing functionality
- **Bug Fixes**: Resolve issues with existing linters
- **Examples**: Create usage examples and tutorials

### 🚀 **Medium Contributions**

- **New Linter Support**: Add missing linters (JSHint, Bandit, RuboCop, etc.)
- **Output Formats**: Implement SARIF or other output formats
- **Performance**: Optimize caching, request handling
- **API Features**: Add new endpoint functionality

### 🎖️ **Advanced Contributions**

- **Architecture**: Core service improvements
- **Security**: Authentication, rate limiting enhancements
- **Monitoring**: Metrics, observability features
- **Scalability**: Multi-instance, load balancing support

## 🔍 **Adding a New Linter**

Here's how to add support for a new linter:

### 1. **Update Type Definitions**

```typescript
// src/types/api.ts
export type LinterType = 'existing-linters' | 'your-new-linter'; // Add your linter here
```

### 2. **Configure Linter Settings**

```typescript
// src/types/linter.ts
export const LINTER_CONFIGS = {
  'your-new-linter': {
    description: 'Your linter description',
    supported_extensions: ['.ext1', '.ext2'],
    fix_supported: true,
    config_file_supported: true,
  },
};
```

### 3. **Implement Linter Logic**

```typescript
// src/services/superLinterRunner.ts
private async runYourNewLinter(workspace: string, options: LinterOptions): Promise<LinterResult> {
  // Implementation here
}
```

### 4. **Add Route Validation**

```typescript
// src/routes/linter.ts - Add to LinterParamSchema enum
const LinterParamSchema = z.enum([
  'existing-linters',
  'your-new-linter', // Add here
]);
```

### 5. **Write Tests**

```typescript
// tests/integration/linters.test.ts
describe('Your New Linter', () => {
  it('should lint code correctly', async () => {
    // Test implementation
  });
});
```

### 6. **Update Documentation**

- Add linter to README.md table
- Update API documentation
- Add usage examples

## 📏 **Coding Standards**

### TypeScript Guidelines

```typescript
// ✅ Good
interface LinterOptions {
  timeout?: number;
  validate_all?: boolean;
}

const runLinter = async (options: LinterOptions): Promise<LinterResult> => {
  // Implementation
};

// ❌ Avoid
const runLinter = (options: any) => {
  // No types, no async handling
};
```

### Code Style

- Use **TypeScript** for type safety
- Follow **ESLint** rules (run `pnpm lint`)
- Use **meaningful variable names**
- Add **JSDoc comments** for public APIs
- Keep functions **small and focused**

### Testing Requirements

- **Unit tests** for new functions
- **Integration tests** for new linters
- **Maintain 80%+ code coverage**
- Test both success and error cases

### Documentation Standards

- Update README.md for user-facing changes
- Add inline code comments for complex logic
- Include usage examples
- Update API documentation

## 🧪 **Testing Guidelines**

### Test Structure

```
tests/
├── unit/              # Unit tests for services, utilities
├── integration/       # Full API endpoint testing
└── utils/            # Test helpers and utilities
```

### Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests (requires Docker)
pnpm test:integration

# With coverage
pnpm test:coverage

# Watch mode during development
pnpm test:watch
```

### Writing Good Tests

```typescript
describe('Linter Service', () => {
  describe('runESLint', () => {
    it('should detect unused variables', async () => {
      const result = await linterService.runESLint({
        content: 'var unused = 42;',
        filename: 'test.js',
      });

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].rule).toBe('no-unused-vars');
    });

    it('should handle syntax errors gracefully', async () => {
      const result = await linterService.runESLint({
        content: 'invalid javascript syntax {[',
        filename: 'test.js',
      });

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
    });
  });
});
```

## 📝 **Pull Request Guidelines**

### PR Title Format

```
feat: add support for JSHint linter
fix: resolve cache invalidation bug
docs: update API documentation for new endpoints
test: add integration tests for Python linters
```

### PR Description Template

```markdown
## Changes

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Manual testing completed

## Screenshots/Demos

(If applicable)

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed code
- [ ] Added necessary documentation
- [ ] Changes generate no new warnings
```

### Review Process

1. **Automated checks** must pass (tests, linting, type checking)
2. **Manual review** by maintainers
3. **Testing** on different environments
4. **Merge** after approval

## 🐛 **Bug Reports**

### Creating Good Bug Reports

```markdown
**Bug Description**
Clear description of the issue.

**Steps to Reproduce**

1. Start API with `docker run...`
2. Send request to `/eslint/json`
3. Observe error

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**

- OS: macOS 13.0
- Node.js: 18.12.0
- Docker: 20.10.17
- API Version: 1.0.0

**Additional Context**
Logs, screenshots, etc.
```

## 💡 **Feature Requests**

### Proposing New Features

1. **Check existing issues** to avoid duplicates
2. **Create detailed proposal** with:
   - Use case and motivation
   - Proposed solution
   - Alternative approaches considered
   - Implementation complexity estimate

3. **Discuss with maintainers** before starting work
4. **Start small** - MVP first, then iterate

## 🏷️ **Issue Labels**

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `question` - Further information needed
- `priority: high` - Critical issues
- `linter: specific` - Issues with specific linters

## 🎖️ **Recognition**

Contributors are recognized in:

- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub Contributors** graph
- **Social media** shout-outs for major features

## 📞 **Getting Help**

- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Code Reviews** - Feedback on pull requests
- **Discord/Slack** - Real-time chat (link in README)

## 📄 **Code of Conduct**

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

**In summary:**

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment
- Report unacceptable behavior

---

## 🙏 **Thank You!**

Every contribution, no matter how small, makes this project better. Whether it's:

- 🐛 Fixing a typo in documentation
- ✨ Adding a new linter
- 🧪 Writing tests
- 💡 Suggesting improvements
- 📖 Improving documentation

**Your contributions are valued and appreciated!**

Happy coding! 🚀
