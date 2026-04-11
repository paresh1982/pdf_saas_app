const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testExtraction() {
  try {
    const filePath = path.join(__dirname, 'test_invoice.pdf');
    const form = new FormData();
    form.append('message', 'Extract all line items from this invoice into a JSON array.');
    form.append('files', fs.createReadStream(filePath));

    console.log('🚀 Sending test extraction request to http://localhost:5000/api/chat...');
    const response = await axios.post('http://localhost:5000/api/chat', form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log('✅ Response Received:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('❌ Extraction failed:');
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

testExtraction();
