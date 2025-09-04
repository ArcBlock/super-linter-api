# Lint a Full Project

The Super-linter API can analyze entire projects, not just single files. This is ideal for bulk analysis, pre-commit hooks, or CI/CD integration. The process involves packaging your project source code into a compressed `tar.gz` archive, encoding it as a Base64 string, and submitting it to a linting endpoint.

This approach allows you to send a complete project context in a single, efficient API request.

### The Workflow

The process can be visualized as a simple pipeline from your local project directory to the API:

```d2
direction: down

"Your Local Project": {
  shape: rectangle
}

"Compressed Archive Stream": {
  shape: document
}

"Base64 Encoded String": {
  shape: document
}

"POST request with archive": {
  shape: rectangle
}

"Super-linter API Server": {
  shape: cylinder
}

"Linting Results (JSON)": {
  shape: document
}

"Your Local Project" -> "Compressed Archive Stream": "`tar czf - .`"
"Compressed Archive Stream" -> "Base64 Encoded String": "`base64 -w 0`"
"Base64 Encoded String" -> "POST request with archive"
"POST request with archive" -> "Super-linter API Server"
"Super-linter API Server" -> "Linting Results (JSON)"

```

### Step-by-Step Guide

To lint a full project, you will package it and send it to the synchronous linting endpoint. The easiest way to do this is with a single shell command.

#### 1. Prepare and Send the Request

This command performs three key actions:
1.  `tar czf - .`: Compresses the current directory (`.`) into a `tar.gz` archive and pipes it to standard output (`-`).
2.  `base64 -w 0`: Encodes the incoming archive stream into a single-line Base64 string.
3.  `curl ...`: Sends the Base64 string within a JSON payload to the API.

Here is a complete, ready-to-use script. Run it from the root of your project directory.

```bash
# Define your API parameters
LINTER="eslint"
FORMAT="json"
API_URL="http://localhost:3000"

# Package, encode, and store the project in a variable
# The --exclude flag prevents common large/unnecessary directories from being included
BASE64_ARCHIVE=$(tar --exclude='./node_modules' --exclude='./.git' --exclude='./dist' -czf - . | base64 -w 0)

# Send the API request with the archive and options
curl -X POST "${API_URL}/${LINTER}/${FORMAT}" \
  -H "Content-Type: application/json" \
  -d '{
    "archive": "'"${BASE64_ARCHIVE}"'",
    "options": {
      "validate_all": true,
      "exclude_patterns": ["*.min.js", "vendor/**"],
      "include_patterns": ["src/**/*.js"]
    }
  }'
```

#### 2. Understand the Response

After a successful request, the API will return a JSON object containing the full analysis. The `file_count` indicates how many files were processed, and the `issues` array lists all findings.

**Example Response:**

```json
{
  "success": true,
  "exit_code": 1,
  "execution_time_ms": 2450,
  "file_count": 42,
  "issues": [
    {
      "file": "src/utils/helpers.js",
      "line": 18,
      "column": 7,
      "rule": "no-unused-vars",
      "severity": "error",
      "message": "'config' is assigned a value but never used.",
      "source": "eslint"
    }
  ],
  "parsed_output": {
    "summary": {
      "errors": 1,
      "warnings": 0,
      "fixable": 0
    }
  }
}
```

### Configuring Project-Level Linting

When submitting an archive, the `options` object in the request body is especially useful for controlling how the entire project is linted. Below are some key parameters.

| Option | Type | Description |
|---|---|---|
| `validate_all` | `boolean` | If `true`, the linter will analyze all supported files in the archive. If `false` (default), it may only lint the first file it finds. Essential for project-wide analysis. |
| `exclude_patterns` | `string[]` | An array of glob patterns for files or directories to exclude from linting, such as `["node_modules/**", "*.min.js"]`. |
| `include_patterns` | `string[]` | An array of glob patterns to explicitly include. If specified, only files matching these patterns will be linted. |
| `config_file` | `string` | The name of a custom configuration file within your project (e.g., `.eslintrc.json`, `pylintrc`) that the linter should use. |
| `fix` | `boolean` | If `true`, the API will attempt to apply auto-fixes for supported linters. Note that the fixed files are not returned; this option is primarily for validating if issues are auto-fixable. |

### Next Steps

Now that you can lint a full project from the command line, the next logical step is to automate this process. Learn how to integrate the Super-linter API into your CI/CD pipeline in our [CI/CD Integration Guide](./guides-ci-cd-integration.md).