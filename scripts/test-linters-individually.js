const axios = require('axios');

// Comprehensive linter definitions with expected sample inputs and validation
const LINTER_TESTS = {
  // JavaScript/TypeScript linters
  eslint: {
    language: 'JavaScript/TypeScript',
    description: 'ESLint - Traditional comprehensive linting',
    sampleCode: `// ESLint test sample
const unused = 42;
var greeting="hello world"
console.log(greeting)
function test(){
  return true
}
if(true){console.log("test")}
let x=1,y=2;`,
    filename: 'test.js',
    expectedIssues: [
      'no-unused-vars',
      'quotes',
      'semi',
      'space-before-blocks',
      'space-infix-ops'
    ],
    minIssues: 3
  },

  oxlint: {
    language: 'JavaScript/TypeScript',
    description: 'Oxlint - Ultra-fast JavaScript/TypeScript linter',
    sampleCode: `// Oxlint test sample  
const unused = 42;
let x: string = "hello";
function test(): boolean {
  return true;
}
var oldVar = "should use let/const";`,
    filename: 'test.ts',
    expectedIssues: [
      'no-unused-vars',
      'prefer-const',
      'no-var'
    ],
    minIssues: 2,
    performanceExpected: true
  },

  biome: {
    language: 'JavaScript/TypeScript',
    description: 'Biome - Ultra-fast formatter',
    sampleCode: `// Biome format test
const  greeting="hello world";console.log(greeting  );
function test(){return true}
let x=1,y=2;
const obj={a:1,b:2};`,
    filename: 'test.js',
    expectedIssues: ['format'],
    minIssues: 1,
    performanceExpected: true
  },

  'biome-lint': {
    language: 'JavaScript/TypeScript', 
    description: 'Biome - Ultra-fast linter',
    sampleCode: `// Biome lint test
const unused = 42;
console.log("hello");
function test() {
  var x = 1;
  return true;
}`,
    filename: 'test.js',
    expectedIssues: [
      'correctness/noUnusedVariables',
      'style/noVar'
    ],
    minIssues: 1,
    performanceExpected: true
  },

  prettier: {
    language: 'JavaScript/TypeScript',
    description: 'Prettier - Code formatter',
    sampleCode: `// Prettier test
const greeting="hello world";console.log(greeting);
function test(){return true}
const obj={a:1,b:2};`,
    filename: 'test.js',
    expectedIssues: ['formatting'],
    minIssues: 0,
    expectsFormatting: true
  },

  jshint: {
    language: 'JavaScript',
    description: 'JSHint - JavaScript code quality tool',
    sampleCode: `// JSHint test
function test() {
  var unused = 42;
  console.log("hello");
  return true
}
if (true) {
  var x = 1;
}`,
    filename: 'test.js',
    expectedIssues: [
      'unused',
      'missing semicolon'
    ],
    minIssues: 1
  },

  // Python linters
  pylint: {
    language: 'Python',
    description: 'Pylint - Python code analysis',
    sampleCode: `# Pylint test
import os
import sys

def test():
    unused_var = 42
    print("hello world")
    return True

class testClass:
    def method(self):
        pass`,
    filename: 'test.py',
    expectedIssues: [
      'unused-variable',
      'invalid-name',
      'import-error'
    ],
    minIssues: 2
  },

  flake8: {
    language: 'Python',
    description: 'Flake8 - Python style guide enforcement',
    sampleCode: `# Flake8 test
import os
import sys

def test():
    unused_var=42
    print("hello world")
    return True


class TestClass:
    def method(self):
        pass`,
    filename: 'test.py',
    expectedIssues: [
      'E302',  // expected 2 blank lines
      'E701',  // multiple statements on one line
      'F401'   // imported but unused
    ],
    minIssues: 2
  },

  black: {
    language: 'Python',
    description: 'Black - Python code formatter',
    sampleCode: `# Black test
def test():
    x=1
    y=2
    return x+y

class TestClass:
    def method(self):
        return True`,
    filename: 'test.py',
    expectedIssues: ['formatting'],
    minIssues: 0,
    expectsFormatting: true
  },

  isort: {
    language: 'Python',
    description: 'isort - Python import sorting',
    sampleCode: `# isort test
import sys
import os
from collections import defaultdict
import json

def test():
    return True`,
    filename: 'test.py',
    expectedIssues: ['import order'],
    minIssues: 0,
    expectsFormatting: true
  },

  bandit: {
    language: 'Python',
    description: 'Bandit - Python security analysis',
    sampleCode: `# Bandit security test
import subprocess
import hashlib

def test():
    password = "admin123"  # B105: hardcoded_password_string
    cmd = "ls -la"
    subprocess.shell(cmd)  # B602: subprocess_popen_with_shell_equals_true
    
    # B303: MD5 hash usage
    hash_md5 = hashlib.md5()
    hash_md5.update(password.encode())
    
    return True`,
    filename: 'test.py',
    expectedIssues: [
      'B105',  // hardcoded password
      'B602',  // shell injection
      'B303'   // MD5 usage
    ],
    minIssues: 2
  },

  mypy: {
    language: 'Python',
    description: 'MyPy - Python static type checker',
    sampleCode: `# MyPy test
def test(x):
    return x + "hello"

def typed_function(name: str) -> int:
    return name  # Type error: returning str instead of int

result = test(42)  # Type error: passing int to function expecting str`,
    filename: 'test.py',
    expectedIssues: [
      'type error',
      'incompatible return type'
    ],
    minIssues: 1
  },

  // Shell
  shellcheck: {
    language: 'Shell',
    description: 'ShellCheck - Shell script analysis',
    sampleCode: `#!/bin/bash
# ShellCheck test

echo "Testing shellcheck"

if [ $1 = "test" ]; then
  echo "Variable not quoted: $undefined_var"
fi

for file in *.txt
do
  echo $file
done`,
    filename: 'test.sh',
    expectedIssues: [
      'SC2086',  // Double quote to prevent globbing
      'SC2006',  // Use $(...) notation
      'SC2048'   // Use "$@" (with quotes) to prevent whitespace problems
    ],
    minIssues: 2
  },

  // Go
  'golangci-lint': {
    language: 'Go',
    description: 'golangci-lint - Go linter aggregator',
    sampleCode: `package main

import (
	"fmt"
	"os"
)

func main() {
	unused := 42
	fmt.Println("hello world")
	
	if true {
		fmt.Println("test")
	}
}`,
    filename: 'main.go',
    expectedIssues: [
      'unused',
      'ineffassign'
    ],
    minIssues: 1
  },

  gofmt: {
    language: 'Go',
    description: 'gofmt - Go code formatter',
    sampleCode: `package main

import(
"fmt"
"os"
)

func main(){
unused:=42
fmt.Println("hello world")
}`,
    filename: 'main.go',
    expectedIssues: ['diff', 'formatting'],
    minIssues: 1,
    expectsFormatting: true
  },

  // Ruby
  rubocop: {
    language: 'Ruby',
    description: 'RuboCop - Ruby style guide enforcer',
    sampleCode: `# RuboCop test
class TestClass
  def test_method
    unused_var = 42
    puts "hello world"
    x=1
    y=2
    return x+y
  end
end`,
    filename: 'test.rb',
    expectedIssues: [
      'Layout/SpaceAroundOperators',
      'Lint/UselessAssignment',
      'Style/RedundantReturn'
    ],
    minIssues: 2
  },

  // Docker
  hadolint: {
    language: 'Docker',
    description: 'Hadolint - Dockerfile linter',
    sampleCode: `FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y curl
COPY . .
USER root
WORKDIR /app
EXPOSE 3000
CMD ["node", "server.js"]`,
    filename: 'Dockerfile',
    expectedIssues: [
      'DL3006',  // Always tag the version of an image explicitly
      'DL3008',  // Pin versions in apt-get install
      'DL3009'   // Delete apt-get lists after installing
    ],
    minIssues: 2
  },

  // YAML
  yamllint: {
    language: 'YAML',
    description: 'yamllint - YAML file linter',
    sampleCode: `# YAML test
name: test-workflow
on: push
jobs:
  test:
   runs-on: ubuntu-latest
   steps:
     - uses: actions/checkout@v2
     - name:  test
       run: echo "hello"
     - name: build  
       run: |
         echo "building"
           echo "done"`,
    filename: 'test.yml',
    expectedIssues: [
      'indentation',
      'line length',
      'trailing spaces'
    ],
    minIssues: 1
  },

  // JSON
  jsonlint: {
    language: 'JSON',
    description: 'jsonlint - JSON file linter',
    sampleCode: `{
  "name": "test-package",
  "version": "1.0.0",
  "description": "Test package",
  "main": "index.js",
  "scripts": {
    "test": "echo test",
  },
  "dependencies": {
    "express": "^4.17.1",
  }
}`,
    filename: 'package.json',
    expectedIssues: [
      'trailing comma',
      'syntax error'
    ],
    minIssues: 1
  },

  // Markdown
  markdownlint: {
    language: 'Markdown',
    description: 'markdownlint - Markdown file linter',
    sampleCode: `# Test Document

This is a test markdown document.

## Section  1  

- Item 1  
- Item 2  

[invalid link](  

### Code Example

\`\`\`javascript
console.log("hello");
\`\`\`

##Missing space before header

- list item without blank line above`,
    filename: 'README.md',
    expectedIssues: [
      'MD009',  // Trailing spaces
      'MD001',  // Header levels should only increment by one
      'MD018'   // No space after hash on atx style header
    ],
    minIssues: 2
  },

  // CSS
  stylelint: {
    language: 'CSS',
    description: 'stylelint - CSS/SCSS linter',
    sampleCode: `/* CSS test */
.container {
  color: #fff;
  background-color:  red;
  margin-top: 10px  ;
  display:  flex;
  color: blue; /* duplicate property */
}

.button {
  background-color: blue;
  color: white;
}
.button { margin: 5px; } /* same selector on same line */

#badId {
  FONT-SIZE: 16px; /* property should be lowercase */
}`,
    filename: 'styles.css',
    expectedIssues: [
      'color-hex-length',
      'declaration-block-duplicate-properties',
      'property-case'
    ],
    minIssues: 2
  }
};

// Enhanced test runner for individual linters
class LinterVerifier {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async testLinter(linterName, testConfig) {
    const startTime = Date.now();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 TESTING: ${linterName.toUpperCase()}`);
    console.log(`📝 ${testConfig.description}`);
    console.log(`🔍 Language: ${testConfig.language}`);
    console.log(`⏱️  Starting verification...`);

    // Add random comment to avoid caching
    const randomId = Math.random().toString(36).substring(7);
    const content = `${testConfig.sampleCode}\n// Random: ${randomId}`;

    const testData = {
      content: content,
      filename: testConfig.filename,
      options: {
        validate_all: false,
        log_level: 'INFO',
        timeout: 20000
      }
    };

    try {
      const response = await axios.post(`${this.baseUrl}/${linterName}/json`, testData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      const executionTime = Date.now() - startTime;
      const result = this.analyzeResponse(linterName, testConfig, response, executionTime);
      
      this.results.push(result);
      this.printTestResult(result);
      
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result = {
        linter: linterName,
        success: false,
        error: this.parseError(error),
        executionTime,
        verified: false
      };
      
      this.results.push(result);
      this.printTestResult(result);
      
      return result;
    }
  }

  analyzeResponse(linterName, testConfig, response, executionTime) {
    const data = response.data;
    const result = {
      linter: linterName,
      success: response.status === 200,
      httpStatus: response.status,
      executionTime,
      apiResponseTime: executionTime,
      linterExecutionTime: data.execution_time_ms || 0,
      exitCode: data.exit_code,
      issuesFound: data.issues?.length || 0,
      issues: data.issues || [],
      verified: false,
      validationResults: {}
    };

    // Verify response structure
    result.validationResults.hasExpectedFields = this.validateResponseStructure(data);
    
    // Verify minimum issues found
    result.validationResults.meetsMinIssues = result.issuesFound >= (testConfig.minIssues || 0);
    
    // Verify expected issue types (if any issues found)
    result.validationResults.hasExpectedIssues = this.validateExpectedIssues(
      result.issues, testConfig.expectedIssues
    );
    
    // Performance verification for fast linters
    if (testConfig.performanceExpected) {
      result.validationResults.performsWell = result.linterExecutionTime < 5000; // < 5 seconds
    }
    
    // Special handling for formatters
    if (testConfig.expectsFormatting) {
      result.validationResults.handlesFormatting = result.exitCode !== undefined;
    }

    // Overall verification
    result.verified = Object.values(result.validationResults).every(v => v === true);

    return result;
  }

  validateResponseStructure(data) {
    const required = ['success', 'exit_code', 'execution_time_ms', 'file_count'];
    return required.every(field => data.hasOwnProperty(field));
  }

  validateExpectedIssues(actualIssues, expectedIssueTypes) {
    if (!expectedIssueTypes || expectedIssueTypes.length === 0) {
      return true; // No specific expectations
    }

    if (!actualIssues || actualIssues.length === 0) {
      return false; // Expected issues but found none
    }

    // Check if any expected issue types are found
    return expectedIssueTypes.some(expectedType => 
      actualIssues.some(issue => 
        issue.rule?.toLowerCase().includes(expectedType.toLowerCase()) ||
        issue.message?.toLowerCase().includes(expectedType.toLowerCase()) ||
        issue.category?.toLowerCase().includes(expectedType.toLowerCase())
      )
    );
  }

  parseError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.error || 'Unknown API error',
        details: error.response.data?.details || null
      };
    } else if (error.code === 'ECONNREFUSED') {
      return {
        status: 'CONNECTION_ERROR',
        message: 'Server not running on ' + this.baseUrl,
        details: null
      };
    } else {
      return {
        status: 'UNKNOWN_ERROR',
        message: error.message,
        details: null
      };
    }
  }

  printTestResult(result) {
    if (result.success && result.verified) {
      console.log(`✅ PASS - All validations successful`);
      console.log(`⚡ API Time: ${result.executionTime}ms | Linter Time: ${result.linterExecutionTime}ms`);
      console.log(`📊 Issues: ${result.issuesFound} | Exit Code: ${result.exitCode}`);
      
      if (result.issues.length > 0) {
        console.log(`🔍 Sample Issues:`);
        result.issues.slice(0, 3).forEach((issue, i) => {
          console.log(`   ${i + 1}. ${issue.rule}: ${issue.message} (${issue.file}:${issue.line}:${issue.column})`);
        });
        if (result.issues.length > 3) {
          console.log(`   ... and ${result.issues.length - 3} more`);
        }
      }
    } else if (result.success) {
      console.log(`⚠️  PARTIAL - API responded but validation failed`);
      console.log(`⚡ API Time: ${result.executionTime}ms | Exit Code: ${result.exitCode}`);
      console.log(`❌ Failed validations:`);
      Object.entries(result.validationResults).forEach(([check, passed]) => {
        if (!passed) {
          console.log(`   - ${check}: FAILED`);
        }
      });
    } else {
      console.log(`❌ FAIL - ${result.error.status}: ${result.error.message}`);
      if (result.error.details) {
        console.log(`🔍 Details: ${result.error.details}`);
      }
    }
  }

  async runAllTests() {
    console.log(`🚀 SUPER-LINTER API COMPREHENSIVE VERIFICATION`);
    console.log(`${'='.repeat(80)}`);
    console.log(`🎯 Testing all ${Object.keys(LINTER_TESTS).length} linters with purpose-built samples`);
    console.log(`🌐 Target: ${this.baseUrl}`);
    console.log(`📋 Each test includes validation of response structure, issue detection, and performance`);

    const startTime = Date.now();
    let passCount = 0;
    let partialCount = 0;
    let failCount = 0;

    for (const [linterName, testConfig] of Object.entries(LINTER_TESTS)) {
      const result = await this.testLinter(linterName, testConfig);
      
      if (result.success && result.verified) {
        passCount++;
      } else if (result.success) {
        partialCount++;
      } else {
        failCount++;
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.printSummary(startTime, passCount, partialCount, failCount);
  }

  async runSingleTest(linterName) {
    const testConfig = LINTER_TESTS[linterName];
    if (!testConfig) {
      console.log(`❌ Unknown linter: ${linterName}`);
      console.log(`Available linters: ${Object.keys(LINTER_TESTS).join(', ')}`);
      return;
    }

    console.log(`🚀 SINGLE LINTER VERIFICATION: ${linterName.toUpperCase()}`);
    console.log(`${'='.repeat(80)}`);
    
    await this.testLinter(linterName, testConfig);
  }

  printSummary(startTime, passCount, partialCount, failCount) {
    const totalTime = Date.now() - startTime;
    const totalTests = Object.keys(LINTER_TESTS).length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 FINAL VERIFICATION RESULTS`);
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ PASS (Fully Verified): ${passCount}/${totalTests}`);
    console.log(`⚠️  PARTIAL (API works, validation issues): ${partialCount}/${totalTests}`);
    console.log(`❌ FAIL (API error): ${failCount}/${totalTests}`);
    console.log(`⏱️  Total Time: ${Math.round(totalTime/1000)}s`);
    console.log(`⚡ Average Time: ${Math.round(totalTime/totalTests)}ms per test`);

    if (passCount === totalTests) {
      console.log(`🎉 ALL LINTERS FULLY VERIFIED - API layer is rock solid!`);
    } else {
      console.log(`⚠️  ${totalTests - passCount} linters need attention`);
      
      const failedResults = this.results.filter(r => !r.success || !r.verified);
      if (failedResults.length > 0) {
        console.log(`\n📋 ISSUES SUMMARY:`);
        failedResults.forEach(result => {
          console.log(`   ${result.linter}: ${result.success ? 'Validation issues' : result.error.message}`);
        });
      }
    }
  }

  async listAvailableTests() {
    console.log(`📋 AVAILABLE LINTER TESTS (${Object.keys(LINTER_TESTS).length} total):`);
    console.log(`${'='.repeat(80)}`);
    
    Object.entries(LINTER_TESTS).forEach(([name, config]) => {
      console.log(`🔧 ${name.padEnd(15)} - ${config.description}`);
    });
    
    console.log(`\nUsage:`);
    console.log(`  node scripts/test-linters-individually.js                    # Test all`);
    console.log(`  node scripts/test-linters-individually.js <linter-name>     # Test one`);
    console.log(`  node scripts/test-linters-individually.js --list           # Show this list`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const verifier = new LinterVerifier();

  if (args.includes('--list') || args.includes('-l')) {
    await verifier.listAvailableTests();
  } else if (args.length === 1 && !args[0].startsWith('--')) {
    await verifier.runSingleTest(args[0]);
  } else if (args.length === 0) {
    await verifier.runAllTests();
  } else {
    console.log(`Usage: node scripts/test-linters-individually.js [linter-name|--list]`);
  }
}

// Export for programmatic use
module.exports = { LinterVerifier, LINTER_TESTS };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}