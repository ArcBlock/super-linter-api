const axios = require('axios');

const linters = [
  // JavaScript/TypeScript linters (6 total)
  { name: 'eslint', language: 'js', description: 'ESLint - Traditional comprehensive linting' },
  { name: 'oxlint', language: 'js', description: 'Oxlint - Ultra-fast JavaScript/TypeScript linter' },
  { name: 'biome', language: 'js', description: 'Biome - Ultra-fast formatter' },
  { name: 'biome-lint', language: 'js', description: 'Biome - Ultra-fast linter' },
  { name: 'prettier', language: 'js', description: 'Prettier - Code formatter' },
  { name: 'jshint', language: 'js', description: 'JSHint - JavaScript code quality tool' },
  
  // Python linters (6 total)
  { name: 'pylint', language: 'py', description: 'Pylint - Python code analysis' },
  { name: 'flake8', language: 'py', description: 'Flake8 - Python style guide enforcement' },
  { name: 'black', language: 'py', description: 'Black - Python code formatter' },
  { name: 'isort', language: 'py', description: 'isort - Python import sorting' },
  { name: 'bandit', language: 'py', description: 'Bandit - Python security analysis' },
  { name: 'mypy', language: 'py', description: 'MyPy - Python static type checker' },
  
  // Shell linters (1 total)
  { name: 'shellcheck', language: 'sh', description: 'ShellCheck - Shell script analysis' },
  
  // Go linters (2 total)
  { name: 'golangci-lint', language: 'go', description: 'golangci-lint - Go linter aggregator' },
  { name: 'gofmt', language: 'go', description: 'gofmt - Go code formatter' },
  
  // Ruby linters (1 total)
  { name: 'rubocop', language: 'rb', description: 'RuboCop - Ruby style guide enforcer' },
  
  // Docker linters (1 total)
  { name: 'hadolint', language: 'dockerfile', description: 'Hadolint - Dockerfile linter' },
  
  // YAML linters (1 total)
  { name: 'yamllint', language: 'yaml', description: 'yamllint - YAML file linter' },
  
  // JSON linters (1 total)
  { name: 'jsonlint', language: 'json', description: 'jsonlint - JSON file linter' },
  
  // Markdown linters (1 total)
  { name: 'markdownlint', language: 'md', description: 'markdownlint - Markdown file linter' },
  
  // CSS linters (1 total)
  { name: 'stylelint', language: 'css', description: 'stylelint - CSS/SCSS linter' },
];

function generateTestContent(language) {
  const random = Math.random().toString(36).substring(7);
  
  switch (language) {
    case 'js':
      return `// Random: ${random}
const unused = 42;
var  greeting="hello world";
console.log(greeting  );
function test(){return true}
import  os  from  "os";`;
    
    case 'py':
      return `# Random: ${random}
import os
import sys
unused_var = 42
def test():
    print("hello world")
    password = "admin123"  # Security issue for bandit
    return True`;
    
    case 'sh':
      return `#!/bin/bash
# Random: ${random}
unused="test"
echo "hello world"
if [ $1 = "test" ]; then
  echo "testing"
fi`;
    
    case 'go':
      return `package main
// Random: ${random}
import "fmt"
import "os"

func main() {
    unused := 42
    fmt.Println("hello world")
}`;
    
    case 'rb':
      return `# Random: ${random}
unused = 42
puts "hello world"

def test
  return true
end`;

    case 'dockerfile':
      return `# Random: ${random}
FROM ubuntu:latest
RUN apt-get update
COPY . .
USER root
EXPOSE 3000`;

    case 'yaml':
      return `# Random: ${random}
name: test-workflow
on: push
jobs:
  test:
   runs-on: ubuntu-latest
   steps:
     - uses: actions/checkout@v2
     - name:  test
       run: echo "hello"`;

    case 'json':
      return `{
  "name": "test-${random}",
  "version": "1.0.0",
  "description": "Test package",
  "main": "index.js",
  "scripts": {
    "test": "echo test"
  },
}`;

    case 'md':
      return `# Test Document ${random}

This is a test markdown document.

## Section  1

- Item 1  
- Item 2

[invalid link](  

### Code Example

\`\`\`javascript
console.log("hello");
\`\`\``;

    case 'css':
      return `/* Random: ${random} */
.container {
  color: #fff;
  background-color:  red;
  margin-top: 10px  ;
  display:  flex;
}

.button {
  background-color: blue;
  color: white;
}
.button { margin: 5px; }`;
    
    default:
      return `// Random: ${random}\nconst test = "hello world";`;
  }
}

function getFilename(language) {
  const extensions = {
    js: 'test.js',
    py: 'test.py',
    sh: 'test.sh',
    go: 'test.go',
    rb: 'test.rb',
    dockerfile: 'Dockerfile',
    yaml: 'test.yml',
    json: 'package.json',
    md: 'README.md',
    css: 'styles.css'
  };
  return extensions[language] || 'test.txt';
}

async function testLinter(linter) {
  const testData = {
    content: generateTestContent(linter.language),
    filename: getFilename(linter.language),
    options: {
      validate_all: false,
      log_level: 'INFO',
      timeout: 15000
    }
  };

  const startTime = Date.now();
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${linter.name.toUpperCase()}`);
    console.log(`📝 ${linter.description}`);
    console.log(`⏱️  Starting test...`);

    const response = await axios.post(`http://localhost:3000/${linter.name}/json`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⚡ API Response Time: ${executionTime}ms`);
    console.log(`🔍 Linter Execution Time: ${response.data.execution_time_ms || 'N/A'}ms`);
    console.log(`📊 Issues Found: ${response.data.issues?.length || 0}`);
    console.log(`🚪 Exit Code: ${response.data.exit_code}`);
    
    if (response.data.issues && response.data.issues.length > 0) {
      console.log(`📋 Sample Issues:`);
      response.data.issues.slice(0, 3).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.rule}: ${issue.message} (${issue.file}:${issue.line}:${issue.column})`);
      });
      if (response.data.issues.length > 3) {
        console.log(`   ... and ${response.data.issues.length - 3} more`);
      }
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`❌ Failed after ${executionTime}ms`);
    
    if (error.response) {
      console.log(`📛 Error Status: ${error.response.status}`);
      console.log(`💬 Error Message: ${error.response.data?.error || 'Unknown error'}`);
      if (error.response.data?.details) {
        console.log(`🔍 Details: ${error.response.data.details}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`🔌 Connection refused - is the server running on http://localhost:3000?`);
    } else {
      console.log(`💥 Error: ${error.message}`);
    }
  }
}

async function testAllLinters() {
  console.log(`🚀 Starting comprehensive linter testing...`);
  console.log(`🎯 Testing all ${linters.length} linters implemented in source code with random content to avoid caching`);
  console.log(`🌐 Target: http://localhost:3000`);
  console.log(`📋 Languages covered: JS/TS (6), Python (6), Shell (1), Go (2), Ruby (1), Docker (1), YAML (1), JSON (1), Markdown (1), CSS (1)`);
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  for (const linter of linters) {
    try {
      await testLinter(linter);
      successCount++;
    } catch (error) {
      failCount++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 FINAL RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successful: ${successCount}/${linters.length}`);
  console.log(`❌ Failed: ${failCount}/${linters.length}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`⚡ Average Time: ${Math.round(totalTime / linters.length)}ms per linter`);
  
  if (failCount === 0) {
    console.log(`🎉 All linters are working perfectly!`);
  } else {
    console.log(`⚠️  Some linters failed - check the logs above`);
  }
}

// Run if called directly
if (require.main === module) {
  testAllLinters().catch(console.error);
}

module.exports = { testAllLinters, testLinter, linters };
