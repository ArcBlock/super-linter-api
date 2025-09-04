# Overview

Super-linter API provides a unified, production-ready HTTP interface for over 18 popular code linters. It's packaged as a single Docker container that you can run with one command, allowing you to start linting code for JavaScript, Python, Go, Ruby, and more in under 10 seconds via a simple REST API.

The main goal is to simplify code quality automation. Instead of managing multiple linter installations and configurations across different projects and CI/CD pipelines, you can deploy a single, centralized service that any tool can communicate with over HTTP.

## How It Works

The API acts as a central gateway for all linting requests. A client, such as a CI/CD job or a code editor plugin, sends a code snippet or a project archive to a specific endpoint. The API server receives the request, runs the corresponding linter in an isolated environment, and returns the results in a standardized format.

```d2
direction: down

"Clients" : {
  shape: package
  grid-columns: 3
  "CI/CD Pipeline": { shape: rectangle }
  "Code Review Tool": { shape: rectangle }
  "Developer Machine": { shape: rectangle }
}

"API Container": {
  label: "Super-linter API (Docker Container)"
  shape: package
  grid-columns: 1

  "HTTP Server": {
    label: "HTTP Server"
    shape: rectangle
  }
  
  "Linter Orchestrator": {
    shape: hexagon
  }
  
  "Linters": {
    shape: package
    grid-columns: 4
    "ESLint": { shape: document }
    "Pylint": { shape: document }
    "gofmt": { shape: document }
    "...15+ more": { shape: document }
  }
  
  "HTTP Server" -> "Linter Orchestrator": "Routes request"
  "Linter Orchestrator" -> "Linters": "Runs specific linter"
  "Linters" -> "Linter Orchestrator": "Returns raw output"
  "Linter Orchestrator" -> "HTTP Server": "Formats response"
}

"Standardized Results": {
  label: "JSON, Text, or SARIF"
  shape: multiple_document
}

"Clients" -> "API Container"."HTTP Server": "POST /{linter}/{format}"
"API Container"."HTTP Server" -> "Standardized Results": "HTTP 200 OK"
```

## Key Features

<x-cards data-columns="3">
  <x-card data-title="Multi-Linter Support" data-icon="lucide:library">
    Access 18+ linters for a wide range of languages through a single API.
  </x-card>
  <x-card data-title="Simple Deployment" data-icon="lucide:box">
    Runs as a single Docker container. Get started with a `docker run` command.
  </x-card>
  <x-card data-title="Flexible Modes" data-icon="lucide:git-compare-arrows">
    Choose between immediate synchronous feedback or background asynchronous jobs for large codebases.
  </x-card>
  <x-card data-title="Versatile Inputs" data-icon="lucide:file-input">
    Send code as plain text, a JSON payload, or a base64-encoded `.tar.gz` archive for full project analysis.
  </x-card>
  <x-card data-title="Standardized Outputs" data-icon="lucide:file-output">
    Receive results in consistent JSON, text, or SARIF formats, regardless of the linter used.
  </x-card>
  <x-card data-title="Built for Automation" data-icon="lucide:bot">
    Ideal for integration into CI/CD pipelines, code review tools, and microservice architectures.
  </x-card>
</x-cards>

## Common Use Cases

Super-linter API is designed for scenarios where consistent and fast code quality checks are essential.

| Use Case                  | Description                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **CI/CD Pipelines**       | Add a fast, reliable linting step to your build and deployment workflows without installing multiple language toolchains on your runners. |
| **Code Review Tools**     | Integrate with automated systems that check pull requests for style and quality issues, providing instant feedback to developers.       |
| **Multi-language Projects** | Use one consistent API to lint a repository containing code in JavaScript, Python, Go, and YAML.                                       |
| **Microservices**         | Provide a centralized linting service for development teams to ensure code quality standards across a distributed architecture.         |

## Example: Linting JavaScript

You can get the API running and lint your first piece of code in two commands.

1.  **Start the API server:**

    ```bash
    docker run -d -p 3000:3000 --name linter-api arcblock/super-linter-api:latest
    ```

2.  **Send a linting request:**

    ```bash
    curl -X POST http://localhost:3000/eslint/json \
      -H "Content-Type: application/json" \
      -d '{
        "content": "const unused = 42; console.log(\"Hello World\");",
        "filename": "demo.js"
      }'
    ```

**Response:**

```json
{
  "success": true,
  "execution_time_ms": 245,
  "issues": [
    {
      "file": "demo.js",
      "line": 1,
      "rule": "no-unused-vars",
      "severity": "error",
      "message": "'unused' is assigned a value but never used."
    }
  ]
}
```

This simple workflow forms the foundation for more complex automations.

---

Ready to try it yourself? Head over to the [Getting Started](./getting-started.md) guide for a step-by-step walkthrough.