const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testConversion() {
  try {
    const filePath = path.join(__dirname, 'test_dates.xlsx');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    console.log('🚀 Sending test Excel-to-PDF request to http://localhost:5000/api/tools/excel-to-pdf...');
    const response = await axios.post('http://localhost:5000/api/tools/excel-to-pdf', form, {
      headers: {
        ...form.getHeaders(),
      },
      responseType: 'arraybuffer'
    });

    console.log('✅ PDF Received! Size:', response.data.byteLength, 'bytes');
    fs.writeFileSync(path.join(__dirname, 'test_output.pdf'), response.data);
    console.log('📄 Saved to backend/test_output.pdf');
  } catch (err) {
    console.error('❌ Conversion failed:');
    if (err.response) {
      console.error(err.response.data.toString());
    } else {
      console.error(err.message);
    }
  }
}

testConversion();
