const axios = require('axios');
const { deflateRaw } = require('zlib');
const { promisify } = require('util');

const deflateAsync = promisify(deflateRaw);

async function testGetEndpoint() {
  console.log('\n=== Testing GET Endpoint ===');
  
  const code = 'console.log("Hello World");';
  
  // Deflate + base64 encode the content (Kroki-style)
  const deflated = await deflateAsync(Buffer.from(code, 'utf-8'));
  const encoded = deflated.toString('base64');
  
  const url = `http://localhost:3000/eslint/json/${encoded}`;
  
  try {
    const response = await axios.get(url, { timeout: 15000 });
    console.log('✅ GET Success - Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('❌ GET Error - Status:', error.response.status);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ GET Network Error:', error.message);
    }
  }
}

async function testPostEndpoint() {
  console.log('\n=== Testing POST Endpoint ===');
  
  const testData = {
    content: 'console.log("Hello World");',
    filename: 'hello.js',
    options: {
      validate_all: false,
      log_level: 'INFO',
      timeout: 10000
    }
  };

  try {
    const response = await axios.post('http://localhost:3000/eslint/json', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ POST Success - Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.log('❌ POST Error - Status:', error.response.status);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ POST Network Error:', error.message);
    }
  }
}

async function testHealthEndpoint() {
  console.log('\n=== Testing Health Endpoint ===');
  
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('✅ Health Success - Status:', response.status);
    console.log('Health Status:', response.data.status);
  } catch (error) {
    console.log('❌ Health Error:', error.message);
  }
}

async function runAllTests() {
  console.log('Starting endpoint tests...');
  
  await testHealthEndpoint();
  await testGetEndpoint();
  await testPostEndpoint();
  
  console.log('\n=== Test Summary ===');
  console.log('All tests completed. Check results above.');
}

runAllTests().catch(console.error);