const axios = require('axios');

async function testBasicEndpoints() {
  console.log('🔧 Testing Fixed Phase 3 Endpoints\n');
  
  const BASE_URL = 'http://localhost:3000';
  
  // Test 1: POST endpoint (should work with database)
  console.log('1. Testing POST /eslint/json endpoint...');
  try {
    const response = await axios.post(`${BASE_URL}/eslint/json`, {
      content: 'console.log("test");',
      filename: 'test.js'
    }, { timeout: 10000 });
    
    console.log('✅ POST endpoint working:', response.status);
  } catch (error) {
    console.log('⚠️ POST endpoint response:', error.response?.status, error.response?.data?.error?.code);
  }
  
  // Test 2: Async job submission
  console.log('\n2. Testing async job submission...');
  try {
    const response = await axios.post(`${BASE_URL}/eslint/json/async`, {
      content: 'console.log("async test");'
    });
    
    console.log('✅ Async job submitted:', response.status, response.data?.job_id);
    
    // Test job status
    if (response.data?.job_id) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await axios.get(`${BASE_URL}/jobs/${response.data.job_id}`);
      console.log('✅ Job status check:', statusResponse.status, statusResponse.data?.status);
    }
    
  } catch (error) {
    console.log('⚠️ Async endpoint response:', error.response?.status, error.response?.data?.error?.code);
  }
  
  // Test 3: Admin endpoints (these were working)
  console.log('\n3. Testing admin endpoints...');
  try {
    const [linters, metrics, cacheStats] = await Promise.all([
      axios.get(`${BASE_URL}/linters`),
      axios.get(`${BASE_URL}/metrics`),
      axios.get(`${BASE_URL}/cache/stats`)
    ]);
    
    console.log('✅ Admin endpoints working:');
    console.log('  - Linters:', linters.data?.linters?.length, 'linters available');
    console.log('  - Metrics: uptime', metrics.data?.uptime_ms, 'ms');
    console.log('  - Cache stats: hit rate', cacheStats.data?.session_stats?.rate || 0, '%');
    
  } catch (error) {
    console.log('⚠️ Admin endpoints error:', error.message);
  }
  
  console.log('\n📊 Fixed endpoints test complete!');
}

testBasicEndpoints().catch(console.error);