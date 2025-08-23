const express = require('express');
const { inflateRaw } = require('zlib');
const { promisify } = require('util');

const inflateAsync = promisify(inflateRaw);
const app = express();

app.get('/test/:linter/:format/:encoded', async (req, res) => {
  try {
    console.log('Parameters:', req.params);
    
    const { linter, format, encoded } = req.params;
    
    // Try to decode the content
    const compressed = Buffer.from(encoded, 'base64');
    const inflated = await inflateAsync(compressed);
    const content = inflated.toString('utf-8');
    
    console.log('Decoded content:', content);
    
    res.json({
      success: true,
      linter,
      format,
      content,
      message: 'Decoding successful'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3002, () => {
  console.log('Simple test server on port 3002');
});