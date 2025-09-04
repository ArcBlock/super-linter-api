# Using SDK Examples

To simplify integration, we provide client library examples for popular programming languages. These examples handle the details of making HTTP requests, allowing you to focus on your application logic. You can use these classes as a starting point for building more complex integrations.

This guide covers the provided examples for Node.js and Python.

---

## Node.js Client

The Node.js client uses the `axios` library to provide a straightforward `LinterAPI` class for interacting with the service.

### Client Code

Here is the complete client class. You can save this as a file in your project (e.g., `linterClient.js`).

```javascript
const axios = require('axios');

class LinterAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({ baseURL });
  }

  async lintCode(linter, code, options = {}) {
    try {
      const response = await this.client.post(`/${linter}/json`, {
        content: code,
        options,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Linting failed: ${error.response?.data?.error?.message}`);
    }
  }

  async lintAsync(linter, code, options = {}) {
    const response = await this.client.post(`/${linter}/json/async`, {
      content: code,
      options,
    });
    return response.data.job_id;
  }

  async getJobResult(jobId) {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }
}
```

### Usage Example

To use the client, instantiate the `LinterAPI` class and call its methods. The following example demonstrates both synchronous and asynchronous linting.

```javascript
// Usage
const linter = new LinterAPI();

async function runLinting() {
  // 1. Synchronous linting for immediate feedback
  try {
    const syncResult = await linter.lintCode('eslint', 'var unused = 42;');
    console.log('Sync issues found:', syncResult.issues.length);
    console.log(syncResult.issues);
  } catch (e) {
    console.error(e.message);
  }

  // 2. Asynchronous linting for long-running jobs
  console.log('\nSubmitting async job...');
  const largeCode = '/* A very large and complex file */\n'.repeat(1000) + 'console.log("hello");';
  const jobId = await linter.lintAsync('eslint', largeCode);
  console.log(`Async job submitted with ID: ${jobId}`);

  let jobStatus = await linter.getJobResult(jobId);
  while (jobStatus.status === 'pending' || jobStatus.status === 'running') {
    console.log(`Job status: ${jobStatus.status}. Checking again in 2 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    jobStatus = await linter.getJobResult(jobId);
  }

  console.log('Async job completed:');
  console.log(JSON.stringify(jobStatus, null, 2));
}

runLinting();
```

---

## Python Client

The Python client uses the `requests` library and provides a similar class-based interface for synchronous and asynchronous operations, including a helper method to poll for job completion.

### Client Code

Save the following class to a file in your Python project (e.g., `linter_client.py`).

```python
import requests
import json
import time

class LinterAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url

    def lint_code(self, linter, code, options=None):
        url = f"{self.base_url}/{linter}/json"
        payload = {
            'content': code,
            'options': options or {}
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()

    def lint_async(self, linter, code, options=None):
        url = f"{self.base_url}/{linter}/json/async"
        payload = {
            'content': code,
            'options': options or {}
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()['job_id']

    def wait_for_job(self, job_id, timeout=60):
        start_time = time.time()

        while time.time() - start_time < timeout:
            response = requests.get(f"{self.base_url}/jobs/{job_id}")
            job_data = response.json()

            if job_data['status'] in ['completed', 'failed', 'cancelled']:
                return job_data

            time.sleep(1)

        raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")
```

### Usage Example

Instantiate the `LinterAPI` class to perform linting tasks. The example below shows how to perform a simple synchronous check and a more complex asynchronous check for a large file.

```python
# Usage
if __name__ == "__main__":
    linter = LinterAPI()

    # 1. Synchronous linting
    print("--- Running Synchronous Linting ---")
    try:
        sync_result = linter.lint_code('pylint', 'import os\nprint("hello world")')
        print(f"Found {len(sync_result.get('issues', []))} issues.")
        print(json.dumps(sync_result, indent=2))
    except requests.exceptions.HTTPError as e:
        print(f"Error during synchronous linting: {e}")

    # 2. Asynchronous linting
    print("\n--- Running Asynchronous Linting ---")
    large_code_file = """import sys

def my_function():
    # A long function
    pass
"""
    try:
        job_id = linter.lint_async('pylint', large_code_file)
        print(f"Asynchronous job submitted with ID: {job_id}")
        
        print("Waiting for job to complete...")
        final_result = linter.wait_for_job(job_id)
        print("Job finished with status:", final_result['status'])
        print(json.dumps(final_result, indent=2))
    except requests.exceptions.HTTPError as e:
        print(f"Error during asynchronous linting: {e}")
    except TimeoutError as e:
        print(e)
```

These SDK examples provide a solid foundation for integrating the Super-linter API into your projects. To see how they can be used in a real-world automation scenario, review the guide on how to [Integrate with CI/CD](./guides-ci-cd-integration.md).