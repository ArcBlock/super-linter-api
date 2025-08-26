const axios = require('axios');

async function testPostEndpoint() {
  const testData = {
    content: `const t = ${Math.random()}; console.log("Hello World"); const a = b;`,
    filename: 'hello.js',
    options: {
      validate_all: false,
      log_level: 'INFO',
      timeout: 10000
    }
  };

  try {
    console.log('Testing POST endpoint...');
    console.log('Request data:', JSON.stringify(testData, null, 2));

    const response = await axios.post('http://localhost:3000/eslint/json', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('Error Response Status:', error.response.status);
      console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testPostEndpoint();
