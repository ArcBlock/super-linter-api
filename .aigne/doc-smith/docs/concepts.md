# Core Concepts

To use the Super-linter API effectively, it's helpful to understand its fundamental components and architecture. This section provides a high-level overview of the key systems that power the service: the linting execution process, the asynchronous job manager, and the intelligent caching layer.

Each component is designed to provide a reliable, scalable, and performant linting service. The following diagram illustrates how they work together to process a typical request.

```d2
direction: down

"API Service": {
  shape: package
  grid-columns: 1

  "User Request": {
    label: "User Request (POST /lint)"
    shape: rectangle
  }

  "Job Manager": {
    shape: rectangle
  }

  "Database": {
    shape: cylinder
  }

  "Cache Service": {
    shape: rectangle
  }

  "Workspace Manager": {
    shape: rectangle
  }

  "Linter Runner": {
    shape: rectangle
  }

  "Linter Executable": {
    shape: rectangle
  }

  "User Request" -> "Job Manager"
  "Job Manager" -> "Database": "1. Create Job Record"
  "Job Manager" -> "Cache Service": "2. Check Cache"
  
  "Cache Service" -> "Job Manager": {
    label: "3a. Cache Hit: Return Result"
    style.stroke: "#52c41a"
  }

  "Cache Service" -> "Workspace Manager": {
    label: "3b. Cache Miss: Create Workspace"
    style.stroke: "#faad14"
  }

  "Workspace Manager" -> "Linter Runner": "4. Provide Workspace Path"
  "Linter Runner" -> "Linter Executable": "5. Spawn Linter Process"
  "Linter Executable" -> "Linter Runner": "6. Return Output"
  "Linter Runner" -> "Cache Service": "7. Store Result"
  "Linter Runner" -> "Job Manager": "8. Return Result"

  "Job Manager" -> "Database": "9. Update Job Record"

}

```

<x-cards data-columns="3">
  <x-card data-title="Linting Execution" data-icon="lucide:play-circle" data-href="/concepts/linting-execution">
    The core of the service is its ability to execute linters against source code in a secure, isolated environment. This process involves creating a temporary workspace, invoking the linter, managing timeouts, and parsing the output into a standardized format.
  </x-card>
  <x-card data-title="Asynchronous Jobs" data-icon="lucide:clock" data-href="/concepts/async-jobs">
    To handle potentially long-running tasks without blocking clients, the API uses an asynchronous job model. Requests are queued, and a job ID is returned for status tracking, allowing for efficient management of concurrent tasks.
  </x-card>
  <x-card data-title="Caching Layer" data-icon="lucide:database" data-href="/concepts/caching">
    To optimize performance, the API includes a powerful caching layer. It generates a unique hash from the code content and linter options, returning cached results instantly for identical requests to save time and resources.
  </x-card>
</x-cards>

---

Understanding these concepts will help you build more efficient and reliable integrations. To see how these components are exposed through the API, proceed to the [API Reference](./api-reference.md).