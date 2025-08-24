const { deflateRaw } = require('zlib');
const { promisify } = require('util');

const deflateAsync = promisify(deflateRaw);

async function createTestRequest() {
  const code = 'console.log("Hello World");';
  
  // Deflate + base64 encode the content (Kroki-style)
  const deflated = await deflateAsync(Buffer.from(code, 'utf-8'));
  const encoded = deflated.toString('base64');
  
  console.log('Original code:', code);
  console.log('Encoded length:', encoded.length);
  console.log('Encoded content:', encoded.substring(0, 50) + '...');
  
  const url = `http://localhost:3000/eslint/json/${encoded}`;
  console.log('\nTest URL:', url);
  
  return { url, encoded };
}

createTestRequest()
  .then(({ url }) => {
    console.log('\nTo test manually:');
    console.log(`curl -X GET "${url}"`);
  })
  .catch(err => {
    console.error('Error:', err.message);
  });