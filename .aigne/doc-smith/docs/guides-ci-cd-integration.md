# Integrate with CI/CD

Automating code quality checks within your Continuous Integration/Continuous Deployment (CI/CD) pipeline helps catch issues early and maintain a consistent standard. The Super-linter API is designed to fit directly into this workflow. By running the API as a service container within your CI job, you can lint your entire project on every push or pull request.

This guide provides a complete example using GitHub Actions to demonstrate how to integrate the API into a typical CI process.

### GitHub Actions Workflow Example

The following workflow definition can be added to your repository (e.g., at `.github/workflows/code-quality.yml`). It sets up the linter API as a service, checks out the code, and then sends the entire project to the API for analysis.

```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    services:
      linter-api:
        image: arcblock/super-linter-api:latest
        ports: ['3000:3000']

    steps:
      - uses: actions/checkout@v3

      - name: Lint JavaScript
        run: |
          response=$(curl -s -X POST http://localhost:3000/eslint/json \
            -d "{\"archive\": \"$(tar czf - . | base64 -w 0)\"}")

          success=$(echo "$response" | jq -r '.success')
          if [ "$success" != "true" ]; then
            echo "Linting failed:"
            echo "$response" | jq '.issues[]'
            exit 1
          fi
```

### Workflow Breakdown

Let's break down the key components of this workflow file:

1.  **`services` Block**: The `services` section launches the `arcblock/super-linter-api:latest` Docker image as a background service container. The CI job can then communicate with the API directly at `http://localhost:3000`.

2.  **`steps` Block**:
    *   **`actions/checkout@v3`**: This is a standard GitHub Action that checks out your repository's code into the runner's workspace.
    *   **`Lint JavaScript`**: This is the core step where the linting is performed.
        *   `tar czf - . | base64 -w 0`: This command sequence packages the entire project directory (`.`) into a compressed `tar.gz` archive and then base64-encodes the result. This allows you to send a complete project context in a single API request.
        *   `curl ...`: The `curl` command sends the base64-encoded archive in a POST request to the `/eslint/json` synchronous linting endpoint.
        *   `jq ...`: The script uses `jq`, a command-line JSON processor, to parse the API's response. It checks the `success` field. If the linting process fails or finds issues, the script prints the reported issues and exits with a status code of `1`, which causes the CI job to fail as expected.

This pattern provides a robust way to enforce code quality standards automatically. For more details on submitting project archives, see the [Lint a Full Project](./guides-lint-project.md) guide. To explore all available endpoints and options, refer to the [API Reference](./api-reference.md).