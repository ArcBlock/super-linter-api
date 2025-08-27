# Guides

This section provides practical tutorials and integration examples to solve common use cases. Whether you need to analyze an entire codebase, automate quality checks in your CI/CD pipeline, or build custom tooling, these guides offer step-by-step instructions and ready-to-use code snippets.

---

### [Lint a Full Project](./guides-lint-project.md)

Learn how to lint an entire local project by packaging it as a `tar.gz` archive. This guide walks you through the process of creating the archive, encoding it in base64, and submitting it to the API for a comprehensive analysis. It's the most efficient way to check a complete codebase in a single request.

### [Integrate with CI/CD](./guides-ci-cd-integration.md)

Automate code quality checks by integrating the Super-linter API directly into your continuous integration pipeline. This guide provides a complete example using GitHub Actions to run the linter on every push and pull request, ensuring code standards are met automatically.

### [Using SDK Examples](./guides-sdk-examples.md)

Interact with the API programmatically using client examples in popular languages. Explore code snippets for Node.js and Python that demonstrate how to handle both synchronous and asynchronous linting jobs, making it easy to build custom integrations and scripts.

---

After following these guides, you'll be equipped to integrate the Super-linter API into your development workflow. For a deeper understanding of how the API works, see the [Core Concepts](./concepts.md) section, or dive into the complete [API Reference](./api-reference.md) for detailed endpoint information.