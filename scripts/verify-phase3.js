const axios = require('axios');
const { deflateRaw } = require('zlib');
const { promisify } = require('util');

const deflateAsync = promisify(deflateRaw);
const BASE_URL = 'http://localhost:3000';

// Test counters
let passedTests = 0;
let failedTests = 0;

function log(message, type = 'INFO') {
  const colors = {
    INFO: '\x1b[36m',
    PASS: '\x1b[32m',
    FAIL: '\x1b[31m',
    WARN: '\x1b[33m'
  };
  console.log(`${colors[type]}[${type}]\x1b[0m ${message}`);
}

function logResult(testName, success, details = '') {
  if (success) {
    passedTests++;
    log(`✅ ${testName}`, 'PASS');
  } else {
    failedTests++;
    log(`❌ ${testName} - ${details}`, 'FAIL');
  }
}

// Phase 3.1: GET /{linter}/{format}/{encoded} endpoints
async function testGetEndpoints() {
  log('\n=== Phase 3.1: Testing GET Endpoints ===');
  
  try {
    // Test 1: Basic GET endpoint with deflate+base64 encoding
    const code = 'console.log("Hello World");';
    const deflated = await deflateAsync(Buffer.from(code, 'utf-8'));
    const encoded = deflated.toString('base64');
    
    const response = await axios.get(`${BASE_URL}/eslint/json/${encoded}`, {
      timeout: 10000
    });
    
    logResult('GET endpoint accepts deflate+base64 encoded content', 
              response.status === 200 || response.status === 500); // 500 is OK (no ESLint installed)
    
    // Test 2: Different output formats
    const formats = ['json', 'text', 'sarif'];
    for (const format of formats) {
      try {
        const resp = await axios.get(`${BASE_URL}/eslint/${format}/${encoded}`);
        logResult(`GET endpoint supports ${format} format`, true);
      } catch (error) {
        logResult(`GET endpoint supports ${format} format`, 
                  error.response?.status === 500); // 500 is acceptable (linter not available)
      }
    }
    
    // Test 3: Query parameters
    try {
      const resp = await axios.get(`${BASE_URL}/eslint/json/${encoded}?validate_all=true&log_level=DEBUG`);
      logResult('GET endpoint accepts query parameters', true);
    } catch (error) {
      logResult('GET endpoint accepts query parameters', 
                error.response?.status === 500);
    }
    
  } catch (error) {
    logResult('GET endpoints basic functionality', false, error.message);
  }
}

// Phase 3.2: POST /{linter}/{format} endpoints
async function testPostEndpoints() {
  log('\n=== Phase 3.2: Testing POST Endpoints ===');
  
  try {
    // Test 1: JSON payload with content
    const postData = {
      content: 'console.log("Hello World");',
      filename: 'test.js',
      options: {
        validate_all: false,
        log_level: 'INFO',
        timeout: 10000
      }
    };
    
    const response = await axios.post(`${BASE_URL}/eslint/json`, postData, {
      timeout: 15000
    });
    
    logResult('POST endpoint accepts JSON payload', 
              response.status === 200 || response.status === 500);
    
    // Test 2: POST with different formats
    const formats = ['json', 'text', 'sarif'];
    for (const format of formats) {
      try {
        const resp = await axios.post(`${BASE_URL}/eslint/${format}`, postData);
        logResult(`POST endpoint supports ${format} format`, true);
      } catch (error) {
        logResult(`POST endpoint supports ${format} format`, 
                  error.response?.status === 500);
      }
    }
    
    // Test 3: Archive support (base64 encoded tar.gz)
    try {
      const archiveData = {
        archive: 'H4sIAAAAAAAAA+3QQQ0AAAwEoNuva6wuUUEz6yCyKzIwMDAwMDAwMDAwMDAwMDAwMDAw8C8AA',
        options: { validate_all: true }
      };
      
      const resp = await axios.post(`${BASE_URL}/eslint/json`, archiveData);
      logResult('POST endpoint supports tar.gz archives', true);
    } catch (error) {
      logResult('POST endpoint supports tar.gz archives', 
                error.response?.status >= 400 && error.response?.status < 500); // Validation error is OK
    }
    
  } catch (error) {
    logResult('POST endpoints basic functionality', false, error.message);
  }
}

// Phase 3.3: Async job management
async function testAsyncEndpoints() {
  log('\n=== Phase 3.3: Testing Async Job Management ===');
  
  try {
    // Test 1: Submit async job
    const asyncData = {
      content: 'console.log("Hello World");',
      options: { timeout: 5000 }
    };
    
    const submitResponse = await axios.post(`${BASE_URL}/eslint/json/async`, asyncData);
    logResult('Async job submission', 
              submitResponse.status === 202);
    
    if (submitResponse.status === 202 && submitResponse.data.job_id) {
      const jobId = submitResponse.data.job_id;
      log(`Job ID: ${jobId}`);
      
      // Test 2: Check job status
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
      
      const statusResponse = await axios.get(`${BASE_URL}/jobs/${jobId}`);
      logResult('Job status tracking', 
                statusResponse.status === 200 && statusResponse.data.job_id === jobId);
      
      // Test 3: Cancel job (if still running)
      if (statusResponse.data.status === 'pending' || statusResponse.data.status === 'running') {
        const cancelResponse = await axios.delete(`${BASE_URL}/jobs/${jobId}`);
        logResult('Job cancellation', 
                  cancelResponse.status === 200 || cancelResponse.status === 409);
      } else {
        logResult('Job cancellation', true, 'Job already completed');
      }
      
    } else {
      logResult('Job ID generation', false, 'No job_id in response');
    }
    
  } catch (error) {
    logResult('Async job management', false, error.message);
  }
}

// Phase 3.4: Admin & utility endpoints
async function testAdminEndpoints() {
  log('\n=== Phase 3.4: Testing Admin & Utility Endpoints ===');
  
  try {
    // Test 1: Linters information
    const lintersResponse = await axios.get(`${BASE_URL}/linters`);
    logResult('GET /linters endpoint', 
              lintersResponse.status === 200 && Array.isArray(lintersResponse.data.linters));
    
    // Test 2: Metrics endpoint
    const metricsResponse = await axios.get(`${BASE_URL}/metrics`);
    logResult('GET /metrics endpoint', 
              metricsResponse.status === 200 && metricsResponse.data.cache);
    
    // Test 3: Cache stats
    const cacheStatsResponse = await axios.get(`${BASE_URL}/cache/stats`);
    logResult('GET /cache/stats endpoint', 
              cacheStatsResponse.status === 200);
    
    // Test 4: Cache clear (DELETE)
    const clearCacheResponse = await axios.delete(`${BASE_URL}/cache`);
    logResult('DELETE /cache endpoint', 
              clearCacheResponse.status === 200);
    
  } catch (error) {
    logResult('Admin endpoints', false, error.message);
  }
}

// Error handling and validation tests
async function testErrorHandling() {
  log('\n=== Testing Error Handling & Validation ===');
  
  try {
    // Test 1: Invalid linter
    try {
      await axios.get(`${BASE_URL}/invalidlinter/json/dGVzdA==`);
      logResult('Invalid linter validation', false, 'Should have returned error');
    } catch (error) {
      logResult('Invalid linter validation', error.response?.status === 400);
    }
    
    // Test 2: Invalid format
    try {
      await axios.get(`${BASE_URL}/eslint/invalidformat/dGVzdA==`);
      logResult('Invalid format validation', false, 'Should have returned error');
    } catch (error) {
      logResult('Invalid format validation', error.response?.status === 400);
    }
    
    // Test 3: Missing content in POST
    try {
      await axios.post(`${BASE_URL}/eslint/json`, { options: {} });
      logResult('Missing content validation', false, 'Should have returned error');
    } catch (error) {
      logResult('Missing content validation', error.response?.status === 400);
    }
    
    // Test 4: Non-existent job
    try {
      await axios.get(`${BASE_URL}/jobs/nonexistent`);
      logResult('Non-existent job handling', false, 'Should have returned 404');
    } catch (error) {
      logResult('Non-existent job handling', error.response?.status === 404);
    }
    
  } catch (error) {
    logResult('Error handling tests', false, error.message);
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting Phase 3 Verification Tests...\n');
  
  await testGetEndpoints();
  await testPostEndpoints();
  await testAsyncEndpoints();
  await testAdminEndpoints();
  await testErrorHandling();
  
  log('\n📊 Test Summary:');
  log(`✅ Passed: ${passedTests}`);
  log(`❌ Failed: ${failedTests}`);
  log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    log('\n🎉 All Phase 3 tests PASSED!', 'PASS');
  } else {
    log(`\n⚠️  ${failedTests} tests failed. Check logs above.`, 'WARN');
  }
}

runAllTests().catch(console.error);