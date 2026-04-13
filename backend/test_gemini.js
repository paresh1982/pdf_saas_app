require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function testGemini() {
  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
  const modelName = 'gemini-1.5-flash'; // Using a known stable model
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, are you working?");
    console.log(`✅ Model ${modelName} is working! Response: ${result.response.text()}`);
  } catch (err) {
    console.error(`❌ Model ${modelName} failed:`, err.message);
  }
}

testGemini();
