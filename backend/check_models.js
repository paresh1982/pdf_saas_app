require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function listModels() {
  try {
    const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
    // Note: The listModels method might vary depending on the library version
    // We will attempt to fetch via the generativeModel interface or standard list
    console.log("🔍 Querying Google Gemini API for available models...");
    
    // In newer versions of the SDK, you can use the listModels method on the client
    // Since we are using @google/genai, we'll try to iterate or catch errors
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("\n✅ AVAILABLE MODELS:");
      data.models.forEach(m => {
        console.log(`- ${m.name.replace('models/', '')} (${m.description || 'No description'})`);
      });
    } else {
      console.log("❌ Could not retrieve models list. Response:", data);
    }
  } catch (err) {
    console.error("❌ Error listing models:", err.message);
  }
}

listModels();
