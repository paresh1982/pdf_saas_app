// ─── Browser Global Resilience Layer (Headless Fix) ─────────
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData { constructor() { this.data = new Uint8ClampedArray(0); } };
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D { constructor() {} };
}

// ─── Rescue Logger ──────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 FATAL CRASH (Uncaught Exception):', err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 FATAL CRASH (Unhandled Rejection):', reason);
  process.exit(1);
});

// Force trust for Supabase SSL certificates in cloud environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, VerticalAlign } = require('docx');
const pdflib = require('pdf-lib');
const { PDFDocument, rgb, degrees, StandardFonts } = pdflib;
const archiver = require('archiver');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const markdownIt = require('markdown-it')();
const { spawn, exec, execSync } = require('child_process');

// --- Cross-Platform Python Detection ---
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// ─── Config ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in environment variables.');
}

// ─── Environment Audit (Triple-Layer Fix) ────────────────
const auditEnvironment = () => {
  console.log('🔍 [AUDIT] Starting Production Environment Check...');
  const pythonVendorPath = path.join(__dirname, 'python_libs');
  console.log(`🔍 [AUDIT] Expected Python Libs at: ${pythonVendorPath}`);
  
  if (fs.existsSync(pythonVendorPath)) {
    const libs = fs.readdirSync(pythonVendorPath);
    console.log(`✅ [AUDIT] Python Libs Found. Count: ${libs.length}`);
  } else {
    console.error('❌ [AUDIT] Python Libs MISSING at path.');
    // Check root as fallback
    const rootVendorPath = path.join(__dirname, '..', 'python_libs');
    if (fs.existsSync(rootVendorPath)) {
      console.log('⚠️ [AUDIT] Found libs in ROOT instead of backend/. This works but is not ideal.');
    }
  }
};
auditEnvironment();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Static Assets (Uploads & Downloads) ─────────────────
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Privacy Middleware ──────────────────────────────────
app.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || 'anonymous';
  next();
});

// ─── PostgreSQL Setup (Supabase) ─────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // Maintain a safe number of connections for Supabase Free Tier
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error if a connection takes longer than 5 seconds
});

// ─── UI Decorators & Privacy Filters ──────────────────────
/**
 * Sanitizes the analysis response to hide internal server paths.
 * Replaces full paths with original filenames or generic labels.
 */
const sanitizeAnalysisResponse = (response, docs) => {
  if (!response || typeof response !== 'object') return response;

  try {
    let jsonStr = JSON.stringify(response);

    // 1. Map absolute paths to Original Display Names
    if (docs && docs.length > 0) {
      const uploadPath = path.join(__dirname, 'uploads').replace(/\\/g, '/');
      const escapedUploadPath = uploadPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Remove the directory prefix first (catch both / and \ variations)
      jsonStr = jsonStr.replace(new RegExp(escapedUploadPath.replace(/\//g, '[\\\\/]') + '[\\\\/]?', 'gi'), '');

      // Replace hashed filenames with original names
      for (const doc of docs) {
        if (doc.filename && doc.original_name) {
          const escapedHashed = doc.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          jsonStr = jsonStr.replace(new RegExp(escapedHashed, 'gi'), doc.original_name);
        }
      }
    }

    // 2. Catch common cloud paths as a safety net
    jsonStr = jsonStr.replace(/\/opt\/render\/project\/src\/backend\/uploads\//gi, '');
    jsonStr = jsonStr.replace(/\/app\/backend\/uploads\//gi, '');
    
    // 3. Remove any remaining raw string prefixes leaking into text (r"/...)
    jsonStr = jsonStr.replace(/r?["']\/[^"']*?uploads\/[^"']*?["']/gi, (match) => {
       // If it contains a known original name, it might have been partially caught. 
       // We just want to strip the path and any 'r' prefix if it survived.
       return match.split('/').pop().replace(/["']$/, '');
    });

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('❌ Sanitization Error:', e);
    return response;
  }
};

const initDB = async () => {
  try {
    // Conversations table
    await pool.query(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT DEFAULT 'New Chat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Messages table
    await pool.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Documents table
    await pool.query(`CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      user_id TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      extracted_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('🐘 PostgreSQL (Supabase) Schema Verified.');
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
  }
};

// initDB() used to be here, moved to startup section below for better sync

// ─── Multer Storage ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only PDF, Word, Excel, CSV, and Images are allowed'), false);
  },
});

// ─── Diagnostic Route ────────────────────────────────────
app.get('/api/admin/env', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    // Check Python version cross-platform
    const pythonVersion = execSync(`${PYTHON_CMD} --version`).toString().trim();
    const pipList = execSync(`${PYTHON_CMD} -m pip list`).toString().trim();
    // Check for local vendor libs (Backend local)
    const vendorPath = path.join(__dirname, 'python_libs');
    const hasVendor = fs.existsSync(vendorPath);
    const vendorLibs = hasVendor ? fs.readdirSync(vendorPath).filter(f => !f.startsWith('.')) : [];
    
    // Read build error log (Project Root)
    const projectRoot = path.join(__dirname, '..');
    const errorLogPath = path.join(projectRoot, 'pip_error.log');
    const pipError = fs.existsSync(errorLogPath) ? fs.readFileSync(errorLogPath, 'utf8') : null;

    res.json({
      timestamp: new Date().toISOString(),
      python: pythonVersion,
      vendor_loaded: hasVendor,
      vendor_count: vendorLibs.length,
      pip_error: pipError,
      packages: pipList.split('\n').filter(line => line.length > 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Diagnostic failed', details: err.message });
  }
});

// ─── Gemini Engine ───────────────────────────────────────
const SYSTEM_PROMPT = `You are DocJockey AI — a universal document intelligence assistant.

You can analyze ANY type of PDF document: invoices, contracts, white papers, 
technical manuals, lab reports, resumes, cheat sheets, academic papers, and more.

### TABULAR EXTRACTION PROTOCOL (CRITICAL)
When the user asks to "build a table", "extract data", or "analyze items":

1. **PERSISTENCE GUARANTEE**: If a value (like "Date", "Invoice #", or "Vendor") appears only once at the top of a page but applies to a table below it, YOU MUST REPEAT that value for every row in the JSON. 
   - **ZERO BLANK POLICY**: No row should have an empty "Date" if a date is detectable on the page.

2. **GOLDEN EXAMPLE (Persistence)**:
   Source Visual:
   Date: 2024-11-20
   | Item | Qty |
   |------|-----|
   | Pen  | 10  |
   | Ink  | 2   |

   Correct Output:
   \`\`\`json
   [
     { "Date": "2024-11-20", "Item": "Pen", "Qty": 10 },
     { "Date": "2024-11-20", "Item": "Ink", "Qty": 2 }
   ]
   \`\`\`

3. **MANDATORY COLUMNS**: Always include "Date", "Description", "Amount", and "Quantity" if they are present or can be inferred.

4. **STANDARDIZE DATES**: Strictly convert all dates to "YYYY-MM-DD" format.

5. **NO MARKDOWN TABLES**: Never return data as | Column | format. Always use \`\`\`json blocks.

6. **FLATTENED STRUCTURE**: Use simple key-value pairs. No nested objects.

7. **TOTALS**: Include "Total" or "Subtotal" rows as the final items in the JSON array.

### CONVERSATIONAL RULES
- Respond helpfully and concisely.
- If asked for a summary, provide a bulleted list of key takeaways.
- If mixed content, provide both JSON and a short summary.
- Never refuse to analyze a document.`;

async function getFileContext(file) {
  const mimeType = file.mimetype;
  const originalName = file.originalname?.toLowerCase() || "";
  
  const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/.test(originalName);
  const isPdf = mimeType === 'application/pdf' || originalName.endsWith('.pdf');
  const isWord = mimeType.includes('word') || originalName.endsWith('.docx') || originalName.endsWith('.doc');
  const isExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel') || originalName.endsWith('.xlsx') || originalName.endsWith('.xls') || originalName.endsWith('.csv');

  console.log(`[DEBUG] Processing: ${file.originalname} | MIME: ${mimeType} | Detection: ${isExcel ? 'Excel' : isPdf ? 'PDF' : isWord ? 'Word' : isImage ? 'Image' : 'Other'}`);

  if (isPdf || isImage) {
    return {
      inlineData: {
        data: fs.readFileSync(file.path).toString('base64'),
        mimeType: isPdf ? 'application/pdf' : (mimeType.startsWith('image/') ? mimeType : 'image/jpeg'),
      },
    };
  } else if (isExcel) {
    const workbook = new ExcelJS.Workbook();
    if (mimeType === 'text/csv' || originalName.endsWith('.csv')) await workbook.csv.readFile(file.path);
    else await workbook.xlsx.readFile(file.path);
    
    let excelText = `[DOCUMENT ATTACHMENT: ${file.originalname}]\n`;
    workbook.eachSheet(sheet => {
      excelText += `--- SHEET: ${sheet.name} ---\n`;
      sheet.eachRow((row, rowNum) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
        excelText += `Row ${rowNum}: | ${values.filter(v => v !== undefined).join(' | ')} |\n`;
      });
      excelText += `\n`;
    });
    return { text: excelText };
  } else if (isWord) {
    return {
      inlineData: {
        data: fs.readFileSync(file.path).toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      text: `[DOCUMENT ATTACHMENT: ${file.originalname}]`
    };
  }
  return null;
}

async function callGemini(contents, customSystemPrompt = null) {
  // --- COST-OPTIMIZER QUEUE: Ascending Price/Intelligence ---
  const models = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview'
  ];

  const systemInstruction = customSystemPrompt || SYSTEM_PROMPT;

  for (let attempt = 0; attempt < models.length; attempt++) {
    const modelName = models[attempt];
    try {
      let result;
      if (typeof ai.getGenerativeModel === 'function') {
        const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
        result = await model.generateContent({ contents, generationConfig: { maxOutputTokens: 8192, temperature: 0.1 } });
      } else {
        result = await ai.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction, maxOutputTokens: 8192 }
        });
      }

      // --- INDESTRUCTIBLE EXTRACTION ---
      let aiText = "";
      try {
        if (result.response) {
          if (typeof result.response.text === 'function') aiText = result.response.text();
          else aiText = result.response.text;
        } else if (result.text) {
          if (typeof result.text === 'function') aiText = result.text();
          else aiText = result.text;
        } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiText = result.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }

      if (!aiText) throw new Error("Empty AI response");
      
      console.log(`✅ [${modelName}] Success (Attempt ${attempt + 1})`);
      return aiText;
    } catch (err) {
      const status = err?.status || err?.code;
      const isRecoverable = [429, 500, 503].includes(status) || err.message.includes('not a function') || err.message.includes('undefined');
      
      if (isRecoverable && attempt < models.length - 1) {
        console.warn(`⚠️ [${modelName}] Busy/Error (${status}). Trying ${models[attempt + 1]}...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      } else {
        throw err;
      }
    }
  }
}



// ─── Routes ──────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DocJockey Document Engine', version: '1.0.0' });
});

// ─── GET Conversations ───────────────────────────────────
app.get('/api/conversations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a conversation
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    // First verify ownership
    const check = await pool.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized to delete this chat.' });
    
    await pool.query('DELETE FROM messages WHERE conversation_id = $1', [req.params.id]);
    await pool.query('DELETE FROM documents WHERE conversation_id = $1', [req.params.id]);
    await pool.query('DELETE FROM conversations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to extract top 5 rows for AI context
async function getSchemaContext(file) {
  try {
    const workbook = new ExcelJS.Workbook();
    const mimeType = file.mimetype || '';
    const originalName = file.originalname?.toLowerCase() || '';
    
    if (mimeType === 'text/csv' || originalName.endsWith('.csv')) {
      await workbook.csv.readFile(file.path);
    } else {
      await workbook.xlsx.readFile(file.path);
    }
    
    let schemaText = `FILE_PATH: ${path.resolve(file.path)}\n`;
    schemaText += `FILE_NAME: ${file.originalname}\n`;
    
    workbook.eachSheet(sheet => {
      schemaText += `--- SHEET: ${sheet.name} ---\n`;
      let rowCount = 0;
      sheet.eachRow((row, rowNum) => {
        if (rowCount >= 5) return;
        const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
        schemaText += `Row ${rowNum}: | ${values.filter(v => v !== undefined).join(' | ')} |\n`;
        rowCount++;
      });
      schemaText += `\n`;
    });
    return schemaText;
  } catch (err) {
    return `FILE_PATH: ${path.resolve(file.path)}\nFILE_NAME: ${file.originalname}\n(Failed to parse schema: ${err.message})`;
  }
}

// ─── DATA ANALYSIS ENDPOINT (Phase 2) ───────────────
app.post('/api/analyze-data', upload.array('files', 10), async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    let convId = conversation_id;

    if (!convId) {
      convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const title = 'Data Analysis: ' + (message?.substring(0, 40) || 'New Session');
      await pool.query(
        'INSERT INTO conversations (id, user_id, title, type) VALUES ($1, $2, $3, $4)',
        [convId, req.userId, title, 'analysis']
      );
    }
    
    await pool.query(
        'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
        [convId, 'user', message || '', JSON.stringify((req.files || []).map(f => f.originalname))]
    );

    // 1. Persist New Documents (if any)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.query(
          'INSERT INTO documents (conversation_id, user_id, filename, original_name, file_size) VALUES ($1, $2, $3, $4, $5)',
          [convId, req.userId, file.filename, file.originalname, file.size]
        );
      }
    }

    // 2. Fetch All Conversation Documents (Context Re-hydration)
    const { rows: docs } = await pool.query(
      'SELECT filename, original_name FROM documents WHERE conversation_id = $1',
      [convId]
    );

    let filesContext = "";
    for (const doc of docs) {
      const filePath = path.join(__dirname, 'uploads', doc.filename);
      if (fs.existsSync(filePath)) {
        // Prepare a pseudo-file object for getSchemaContext
        const pseudoFile = { path: filePath, originalname: doc.original_name };
        const schema = await getSchemaContext(pseudoFile);
        if (schema) filesContext += schema + "\n\n";
      }
    }

    // 3. Fetch Message History
    const { rows: history } = await pool.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [convId]
    );
    
    // Map history to Gemini format (ignoring the temporary Analyst message being built)
    const geminiHistory = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    // 4. Call Gemini using the resilient Model Queue
    const systemPrompt = `You are an expert Data Analyst and Python Developer. 

YOUR MISSION:
Write a Python script that reads the provided FILE_PATHs using pandas and performs a high-fidelity analysis as requested by the user.

CRITICAL RULES:
1. ONLY return valid Python code wrapped in \`\`\`python ... \`\`\`. Do NOT include any conversational filler.
2. DISCOVERY: Print the result as a raw JSON "MultiView" payload to stdout.
3. VISUAL INTELLIGENCE: By default, provide a chartConfig for a visual dashboard. HOWEVER, if the user explicitly asks to avoid plots or charts, focus strictly on providing a high-fidelity 'summary' (brief idea about the data) and a 'tableData' view.
4. META-ANALYTICS: For summaries, always include a 'Meta Data' section describing row/column counts and the inferred purpose of the dataset.
5. Use absolute paths provided in the context below.

EXAMPLE OUTPUT FORMAT:
\`\`\`python
import json
# ... analysis logic ...
response = {
    "type": "multiview",
    "summary": "Comparing vehicle performance across groups...",
    "primaryView": "scatter",
    "tableData": df.to_dict(orient="records"),
    "chartConfig": {
        "type": "scatter",
        "data": df.to_dict(orient="records"),
        "xAxisKey": "weight", 
        "yAxisKey": "mpg",
        "groupByKey": "cylinders" # REQUIRED for multi-series colors and legend
    }
}
print(json.dumps(response))
\`\`\`

GENERAL:
1. ONLY return python code.
2. USE paths exactly as given.
3. REFER to previous messages for context if needed.`;

    const contents = [...geminiHistory];
    // If files were just uploaded but not yet in the prompt part, append the final prompt with filesContext
    contents[contents.length - 1].parts[0].text += `\n\n### Available Data Files (Current Schema Context):\n${filesContext}`;

    const aiText = await callGemini(contents, systemPrompt);
    
    // 3. Robust Line-by-Line Code Extraction
    let pythonCode = "";
    
    const extractPython = (text) => {
        const lines = text.split('\n');
        let insideCode = false;
        let code = [];
        for (const line of lines) {
            if (!insideCode && (line.trim().startsWith('\`\`\`python') || line.trim() === '\`\`\`')) {
                insideCode = true;
                continue;
            }
            if (insideCode && line.trim() === '\`\`\`') {
                break;
            }
            if (insideCode) {
                code.push(line);
            }
        }
        return code.join('\n').trim();
    };

    pythonCode = extractPython(aiText);
    
    if (pythonCode.length > 0) {
       // Code extracted properly
    } else {
       // Fallback: If AI just returned code without backticks or language tag
       const lines = aiText.split('\n');
       const hasPandas = lines.some(l => l.includes('import pandas') || l.includes('pd.'));
       const isJSON = aiText.trim().startsWith('{') && aiText.trim().endsWith('}');
       
       if (hasPandas) {
          pythonCode = aiText.trim();
       } else if (isJSON) {
          // JSON Leak Fix: Wrap raw JSON in a print script
          pythonCode = `import json\nprint(json.dumps(${aiText.trim()}))`;
       } else {
          // If totally conversational, create a dummy print script
          pythonCode = `print("""${aiText.replace(/"/g, '\\"')}""")`;
       }
    }

    // 3.5 Auto-correct hallucinated paths AND Check for Expired Render Disk Files
    let missingFiles = [];
    if (docs && docs.length > 0) {
       for (const doc of docs) {
           const correctPath = path.join(__dirname, 'uploads', doc.filename).replace(/\\/g, '/');
           if (!fs.existsSync(correctPath)) {
               missingFiles.push(doc.original_name);
           }
           // Match any string containing the original filename, including optional 'r' prefix, and replace the whole path
           const nameEscaped = doc.original_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           const regex = new RegExp(`r?['"][^'"]*?${nameEscaped}['"]`, 'gi');
           pythonCode = pythonCode.replace(regex, `r"${correctPath}"`);
       }
       // Fallback for strictly hallucinatory directories if there's only 1 document
       if (docs.length === 1) {
           const correctPath = path.join(__dirname, 'uploads', docs[0].filename).replace(/\\/g, '/');
           pythonCode = pythonCode.replace(/r?['"]\/mnt\/data\/[^'"]+['"]/gi, `r"${correctPath}"`);
           pythonCode = pythonCode.replace(/r?['"]\/app\/data\/[^'"]+['"]/gi, `r"${correctPath}"`);
       }
    }

    // Abort execution if files were purged by Render's ephemeral disk system
    if (missingFiles.length > 0 && docs.length === missingFiles.length) {
        const errorMsg = `⚠️ **Session Expired:** The underlying data files (${missingFiles.join(', ')}) were purged from our server's temporary storage. Please start a new chat and re-upload the files to continue analysis.`;
        
        await pool.query(
            'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
            [convId, 'model', errorMsg, JSON.stringify([{ type: 'python_code', code: '# Execution aborted due to missing physical files.\n# Please re-upload the dataset.' }])]
        );
        return res.json({ response: errorMsg, conversation_id: convId, python_code: '' });
    }

    // 4. Save and execute
    const { exec } = require('child_process');
    // Save inside scripts/ to keep it clean
    const tempScriptPath = path.join(__dirname, 'scripts', `temp_analysis_${Date.now()}.py`);
    
    // Bootstrap Python to find the vendored libraries in backend/python_libs
    const bootstrap = `import sys, os
sc_dir = os.path.dirname(os.path.abspath(__file__))
v_dir = os.path.abspath(os.path.join(sc_dir, '..', 'python_libs'))
if os.path.exists(v_dir): sys.path.insert(0, v_dir)

`;
    fs.writeFileSync(tempScriptPath, bootstrap + pythonCode);

    const execPromise = new Promise((resolve) => {
       // Use cross-platform command (python on Windows, python3 on Linux)
       exec(`${PYTHON_CMD} "${tempScriptPath}"`, { timeout: 45000 }, (error, stdout, stderr) => {
           if (error) {
               resolve(`❌ **Python Execution Error**:\n\`\`\`text\n${stderr || error.message}\n\`\`\``);
           } else {
               let outputText = (stdout || '').trim();
               
               // --- INTEGRATED SANITIZATION LAYER ---
               try {
                   const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                   if (jsonMatch) {
                       let parsed = JSON.parse(jsonMatch[0]);
                       parsed = sanitizeAnalysisResponse(parsed, docs);
                       
                       // --- INTENT DETECTION (Refinement) ---
                        const visualKeywords = ['plot', 'graph', 'chart', 'visual', 'visualise', 'trend', 'distribution', 'scatter', 'bar', 'histogram', 'line', 'view relationship', 'relationship', 'correlation', 'compare'];
                       const userPrompt = (message || "").toLowerCase();
                       const hasVisualIntent = visualKeywords.some(k => userPrompt.includes(k));
                       
                       if (hasVisualIntent) {
                           parsed.primaryView = parsed.primaryView || "chart";
                       } else {
                           parsed.primaryView = "table"; 
                       }
                       
                       const cleanJson = JSON.stringify(parsed, null, 2);
                       outputText = outputText.replace(jsonMatch[0], `\n\`\`\`json\n${cleanJson}\n\`\`\`\n`);
                   } else {
                       const sanitized = sanitizeAnalysisResponse({ t: outputText }, docs);
                       outputText = sanitized.t;
                   }
               } catch (e) {
                   console.error('⚠️ Sanitization Error:', e);
               }

               resolve(`🔬 **Data Analysis Result**:\n\n${outputText}`);
           }
       });
    });

    let finalResult = await execPromise;

    // Cleanup
    try { fs.unlinkSync(tempScriptPath); } catch (e) {}
    // req.files are NO LONGER unlinked here to allow follow-up questions in the same conversation.

    await pool.query(
        'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
        [convId, 'model', finalResult, JSON.stringify([{ type: 'python_code', code: pythonCode }])]
    );

    res.json({ 
        response: finalResult, 
        conversation_id: convId,
        python_code: pythonCode 
    });
  } catch (err) {
    // We don't unlink data files on error either, to allow troubleshooting/retries.
    res.status(500).json({ error: 'Analysis execution failed', details: err.message });
  }
});

// ─── CHAT ENDPOINT (The Core) ────────────────────────────
app.post('/api/chat', upload.array('files', 10), async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    let convId = conversation_id;

    // Auto-create conversation if none provided
    if (!convId) {
      convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const title = message?.substring(0, 60) || 'New Chat';
      await pool.query(
        'INSERT INTO conversations (id, user_id, title, type) VALUES ($1, $2, $3, $4)',
        [convId, req.userId, title, 'chat']
      );
    }

    // Process files for AI context
    const fileContexts = [];
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const context = await getFileContext(file);
        if (context) fileContexts.push(context);
        
        // Save to DB
        await pool.query(
          'INSERT INTO documents (conversation_id, user_id, filename, original_name, file_size) VALUES ($1, $2, $3, $4, $5)',
          [convId, req.userId, file.filename, file.originalname, file.size]
        );
        uploadedDocs.push({ filename: file.filename, original_name: file.originalname });
      }
    }

    // Save user message
    const attachmentNames = uploadedDocs.map(d => d.original_name);
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
      [convId, 'user', message || '', JSON.stringify(attachmentNames)]
    );

    // Load history
    const historyResult = await pool.query(
      'SELECT role, content, attachments FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [convId]
    );
    const dbMessages = historyResult.rows;

    const contents = [];
    for (const [index, msg] of dbMessages.entries()) {
      const isLastMessage = index === dbMessages.length - 1;
      let combinedText = msg.content;
      const inlineDataParts = [];

      // ─── Document Data Recovery ───
      if (isLastMessage && fileContexts.length > 0) {
        // Current turn: Use freshly extracted memory contexts
        for (const ctx of fileContexts) {
          if (ctx.text) combinedText += `\n\n--- DOCUMENT DATA ---\n${ctx.text}`;
          if (ctx.inlineData) inlineDataParts.push({ inlineData: ctx.inlineData });
        }
      } else if (msg.attachments && msg.attachments !== '[]') {
        // Historical turns: Restore from disk
        try {
          const fileNames = JSON.parse(msg.attachments);
          const docsResult = await pool.query(
            'SELECT filename, original_name FROM documents WHERE conversation_id = $1 AND original_name = ANY($2)',
            [convId, fileNames]
          );
          
          let missingFiles = [];
          
          for (const doc of docsResult.rows) {
            const filePath = path.join(UPLOAD_DIR, doc.filename);
            if (fs.existsSync(filePath)) {
              const fileContext = await getFileContext({ 
                path: filePath, 
                mimetype: 'application/octet-stream', // Let fallback extension detection handle it
                originalname: doc.original_name
              });
              if (fileContext) {
                if (fileContext.text) combinedText += `\n\n--- DOCUMENT DATA ---\n${fileContext.text}`;
                if (fileContext.inlineData) inlineDataParts.push({ inlineData: fileContext.inlineData });
              }
            } else {
              missingFiles.push(doc.original_name);
            }
          }
          
          if (missingFiles.length > 0) {
              const errorMsg = `⚠️ **Session Expired:** The underlying documents (${missingFiles.join(', ')}) were purged from our server's temporary storage. Please start a new chat and re-upload the files to continue extraction.`;
              await pool.query(
                  'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                  [convId, 'model', errorMsg]
              );
              return res.json({ response: errorMsg, conversation_id: convId });
          }
        } catch (e) {
          console.error("Context recovery failed:", e);
        }
      }

      // ─── Build final parts for this turn ───
      const parts = [{ text: combinedText }, ...inlineDataParts];
      contents.push({ role: msg.role, parts });
    }

    // Call Gemini
    console.log(`🧠 NexGen Chat [${convId}]: "${(message || '').substring(0, 80)}..." (${uploadedDocs.length} files)`);
    const aiResponse = await callGemini(contents);

    // Save AI response
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'model', aiResponse]
    );

    // Update conversation timestamp
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [convId]);

    res.json({
      conversation_id: convId,
      response: aiResponse,
      files_processed: uploadedDocs.map(d => d.original_name),
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI processing failed', details: err.message });
  }
});

// ─── PDF TOOL: Merge ─────────────────────────────────────
app.post('/api/tools/merge', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Please upload at least 2 PDF files to merge.' });
    }

    const mergedPdf = await PDFDocument.create();
    for (const file of req.files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      // Cleanup temp files
      fs.unlinkSync(file.path);
    }

    const mergedPdfBytes = await mergedPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Merged.pdf');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    res.status(500).json({ error: 'Merge failed', details: err.message });
  }
});

// ─── PDF TOOL: Split ─────────────────────────────────────
app.post('/api/tools/split', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF to split.' });
    const { ranges } = req.body;

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();

    // ─── Scenario A: Specific Ranges provided ───
    if (ranges && ranges.trim() !== '') {
      const tokens = ranges.split(',').map(s => s.trim()).filter(t => t !== '');
      
      // If only ONE range is provided, return a single PDF
      if (tokens.length === 1) {
        const token = tokens[0];
        const resultPdf = await PDFDocument.create();
        let indices = [];
        
        if (token.includes('-')) {
          const [start, end] = token.split('-').map(Number);
          if (start > 0 && end <= pageCount && start <= end) {
            indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
          }
        } else {
          const pageNum = Number(token);
          if (pageNum > 0 && pageNum <= pageCount) indices = [pageNum - 1];
        }

        if (indices.length === 0) return res.status(400).json({ error: 'Invalid page range provided.' });

        const copiedPages = await resultPdf.copyPages(pdf, indices);
        copiedPages.forEach(p => resultPdf.addPage(p));
        const outBytes = await resultPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Split.pdf');
        return res.send(Buffer.from(outBytes));
      } 
      
      // If MULTIPLE ranges are provided, return a ZIP archive
      else {
        const archive = archiver('zip', { zlib: { level: 9 } });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Split_Ranges.zip');
        archive.pipe(res);

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          const rangePdf = await PDFDocument.create();
          let indices = [];

          if (token.includes('-')) {
            const [start, end] = token.split('-').map(Number);
            if (start > 0 && end <= pageCount && start <= end) {
              indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
            }
          } else {
            const pageNum = Number(token);
            if (pageNum > 0 && pageNum <= pageCount) indices = [pageNum - 1];
          }

          if (indices.length > 0) {
            const copiedPages = await rangePdf.copyPages(pdf, indices);
            copiedPages.forEach(p => rangePdf.addPage(p));
            const rangeBytes = await rangePdf.save();
            archive.append(Buffer.from(rangeBytes), { name: `split_part_${i + 1}.pdf` });
          }
        }
        await archive.finalize();
        return;
      }
    } 
    // ─── Scenario B: Explode all pages (Default) ───
    else {
      if (pageCount < 2) return res.status(400).json({ error: 'This PDF only has 1 page and cannot be split.' });
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Split_Pages.zip');
      archive.pipe(res);

      for (let i = 0; i < pageCount; i++) {
        const subPdf = await PDFDocument.create();
        const [copiedPage] = await subPdf.copyPages(pdf, [i]);
        subPdf.addPage(copiedPage);
        const subPdfBytes = await subPdf.save();
        archive.append(Buffer.from(subPdfBytes), { name: `page_${i + 1}.pdf` });
      }
      await archive.finalize();
    }

    fs.unlinkSync(req.file.path);
  } catch (err) {
    res.status(500).json({ error: 'Split failed', details: err.message });
  }
});

// ─── PDF TOOL: Compress ──────────────────────────────────
app.post('/api/tools/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF to compress.' });

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    // pdf-lib's built-in compression happens during save()
    const compressedBytes = await pdf.save({ 
      useObjectStreams: true, 
      addDefaultPage: false 
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Compressed.pdf');
    res.send(Buffer.from(compressedBytes));
    
    fs.unlinkSync(req.file.path);
  } catch (err) {
    res.status(500).json({ error: 'Compression failed', details: err.message });
  }
});

// ─── TOOL HELPER: Multimodal Data ────────────────────
const getMultimodalData = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let mimeType = 'application/pdf';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  
  return {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };
};

// ─── PDF TOOL: PDF to Word (High Fidelity) ───────────────
app.post('/api/tools/pdf-to-word', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF.' });
    
    const inputData = getMultimodalData(req.file.path);
    const prompt = `Act as a High-Fidelity Document Architect. 
    Analyze this document and extract its EXACT structure.
    
    1. Identify headers (H1 for main titles, H2 for section headers).
    2. Identify regular paragraphs.
    3. Identify ALL tables and extract them as 2D arrays (rows of columns).
    4. Group content in the exact order it appears.
    
    RETURN ONLY a JSON array of blocks:
    [
      { "type": "h1", "content": "Title text" },
      { "type": "paragraph", "content": "Paragraph text..." },
      { "type": "table", "content": [["Cell 1", "Cell 2"], ["Cell 3", "Cell 4"]] },
      { "type": "h2", "content": "Subtitle" }
    ]
    
    CRITICAL: NO CONVERSATIONAL TEXT. NO MARKDOWN. ONLY RAW JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }, inputData] }]
    });

    const blocks = extractCleanJson(response.text);

    const doc = new Document({
      sections: [{
        properties: {},
        children: blocks.map(block => {
          const cleanContent = typeof block.content === 'string' 
            ? block.content.replace(/\*\*\*/g, '').replace(/\*\*/g, '') 
            : block.content;

          if (block.type === 'h1') {
            return new Paragraph({
              text: String(cleanContent),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            });
          }
          if (block.type === 'h2') {
            return new Paragraph({
              text: String(cleanContent),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 }
            });
          }
          if (block.type === 'table') {
            const rows = Array.isArray(block.content) ? block.content : [];
            return new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows.map(row => new TableRow({
                children: (Array.isArray(row) ? row : Object.values(row)).map(cell => {
                  const cleanCell = typeof cell === 'string' ? cell.replace(/\*\*\*/g, '').replace(/\*\*/g, '') : cell;
                  return new TableCell({
                    children: [new Paragraph({ text: String(cleanCell || ''), spacing: { before: 80, after: 80 } })],
                    verticalAlign: VerticalAlign.CENTER,
                  });
                })
              }))
            });
          }
          // Default: Paragraph
          return new Paragraph({
            children: [new TextRun({ text: String(cleanContent || ""), size: 22 })],
            spacing: { after: 200 }
          });
        }).flat()
      }],
      styles: {
        default: {
          heading1: { run: { size: 36, bold: true, color: "111827", font: "Helvetica" } },
          heading2: { run: { size: 28, bold: true, color: "374151", font: "Helvetica" } },
        }
      }
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=NexGen_Structural_Export.docx');
    res.send(buffer);
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('PDF-to-Word Error:', err);
    res.status(500).json({ error: 'Word conversion failed', details: err.message });
  }
});

// ─── PDF TOOL: Repair ───────────────────────────────────
app.post('/api/tools/repair', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF to repair.' });

    const pdfBytes = fs.readFileSync(req.file.path);
    // Lenient loading to handle corruption
    const pdf = await PDFDocument.load(pdfBytes, { 
      ignoreEncryption: true,
      throwOnInvalidObject: false 
    });
    
    // Saving with full object streams often fixes XREF table damage
    const repairedBytes = await pdf.save({ useObjectStreams: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Repaired.pdf');
    res.send(Buffer.from(repairedBytes));
    
    fs.unlinkSync(req.file.path);
  } catch (err) {
    res.status(500).json({ error: 'Repair failed', details: err.message });
  }
});

// ─── PDF TOOL: A.I. Smart Redraft (High Fidelity) ───────
app.post('/api/tools/edit', upload.single('file'), async (req, res) => {
  try {
    const { instructions } = req.body;
    if (!req.file || !instructions) return res.status(400).json({ error: 'Missing file or instructions.' });

    const inputData = getMultimodalData(req.file.path);
    const prompt = `Act as a Professional Document Editor. 
    TASK: Apply these edits: "${instructions}" to the provided document.
    
    CRITICAL: You must reconstruct the document's structure. 
    Identify its headers, paragraphs, and tables.
    Apply the edits while keeping the original formatting hierarchy.
    
    RETURN ONLY a JSON array of blocks:
    [
      { "type": "h1", "content": "Title" },
      { "type": "paragraph", "content": "..." },
      { "type": "table", "content": [["Row1Col1", "Row1Col2"], ["Row2Col1", "Row2Col2"]] }
    ]
    
    NO CONVERSATIONAL TEXT. NO MARKDOWN. ONLY RAW JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }, inputData] }]
    });

    const blocks = extractCleanJson(response.text);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([600, 842]);
    const { width, height } = page.getSize();
    let y = height - 40;
    const margin = 50;
    const availableWidth = width - (margin * 2);

    for (const block of blocks) {
      if (y < 60) {
        page = pdfDoc.addPage([600, 842]);
        y = height - 40;
      }

      const rawContent = typeof block.content === 'string' 
        ? block.content.replace(/\*\*\*/g, '').replace(/\*\*/g, '') 
        : block.content;
      
      const content = sanitizeForPdf(rawContent).replace(/\n/g, ' ').replace(/\r/g, ' ');

      if (block.type === 'h1' || block.type === 'h2') {
        const size = block.type === 'h1' ? 16 : 13;
        const color = block.type === 'h1' ? rgb(0.05, 0.2, 0.5) : rgb(0.1, 0.1, 0.1);
        page.drawText(String(content), { x: margin, y: y - size, size, font: fontBold, color });
        y -= (size + 15);
      } 
      else if (block.type === 'table') {
        const rows = Array.isArray(block.content) ? block.content : [];
        if (rows.length === 0) continue;
        
        const colCount = rows[0].length;
        const colWidth = availableWidth / Math.max(colCount, 1);
        const rowHeight = 22;

        for (const [rowIndex, row] of rows.entries()) {
          if (y < 60) { 
            page = pdfDoc.addPage([600, 842]); 
            page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
            y = height - 50; 
          }
          
          let x = margin;
          // Draw header background tint
          if (rowIndex === 0) {
            page.drawRectangle({ x, y: y - rowHeight, width: availableWidth, height: rowHeight, color: rgb(0.69, 0.69, 0.69) });
          }

          for (const cell of row) {
            const rawCell = String(cell || '').replace(/\*\*\*/g, '').replace(/\*\*/g, '');
            const cellText = sanitizeForPdf(rawCell).substring(0, 45);
            
            page.drawRectangle({
              x, y: y - rowHeight,
              width: colWidth, height: rowHeight,
              borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5
            });

            page.drawText(cellText, {
              x: x + 6, y: y - (rowHeight / 1.5),
              size: 7.5, font: rowIndex === 0 ? fontBold : font,
              color: rowIndex === 0 ? rgb(0.05, 0.2, 0.4) : rgb(0.2, 0.2, 0.2)
            });
            x += colWidth;
          }
          y -= rowHeight;
        }
        y -= 15;
      } 
      else {
        const words = String(content).split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          if (font.widthOfTextAtSize(testLine, 9.5) > availableWidth) {
            page.drawText(line, { x: margin, y, size: 9.5, font, color: rgb(0.25, 0.25, 0.25) });
            y -= 13.5;
            line = word;
            if (y < 50) { 
              page = pdfDoc.addPage([600, 842]); 
              page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
              y = height - 50; 
            }
          } else {
            line = testLine;
          }
        }
        page.drawText(line, { x: margin, y, size: 9.5, font, color: rgb(0.25, 0.25, 0.25) });
        y -= 18;
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Smart_Redraft_Export.pdf');
    res.send(Buffer.from(pdfBytes));
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('Smart Redraft Error:', err);
    res.status(500).json({ error: 'Editing failed', details: err.message });
  }
});



// ─── PDF TOOL: Rotate ────────────────────────────────────
app.post('/api/tools/rotate', upload.single('file'), async (req, res) => {
  try {
    const { degrees } = req.body;
    if (!req.file || !degrees) return res.status(400).json({ error: 'Missing file or rotation degrees.' });

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdf.getPages();
    
    const rot = parseInt(degrees) || 90;
    pages.forEach(page => {
      let currentRotation = 0;
      try {
        const r = page.getRotation();
        currentRotation = (typeof r === 'object' ? r.angle : r) || 0;
      } catch (e) { currentRotation = 0; }
      
      const newAngle = (currentRotation + rot) % 360;
      
      if (typeof degrees === 'function') {
        page.setRotation(degrees(newAngle));
      } else {
        // Fallback for older versions or binding issues
        page.setRotation({ angle: newAngle, type: 'degrees' });
      }
    });

    const outBytes = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Rotated.pdf');
    res.send(Buffer.from(outBytes));
    
    fs.unlinkSync(req.file.path);
  } catch (err) {
    res.status(500).json({ error: 'Rotation failed', details: err.message });
  }
});

// ─── PDF TOOL: Reorder ───────────────────────────────────
app.post('/api/tools/reorder', upload.single('file'), async (req, res) => {
  try {
    const { sequence } = req.body; // e.g., "3, 1, 2"
    if (!req.file || !sequence) return res.status(400).json({ error: 'Missing file or page sequence.' });

    const pdfBytes = fs.readFileSync(req.file.path);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdf.getPageCount();

    const order = sequence.split(',').map(s => parseInt(s.trim())).filter(n => n > 0 && n <= pageCount);
    if (order.length === 0) return res.status(400).json({ error: 'Invalid page sequence.' });

    const newPdf = await PDFDocument.create();
    // Copy pages in the specified order
    const copiedPages = await newPdf.copyPages(pdf, order.map(i => i - 1));
    copiedPages.forEach(p => newPdf.addPage(p));

    const outBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=OneStopDoc_Reordered.pdf');
    res.send(Buffer.from(outBytes));
    
    fs.unlinkSync(req.file.path);
  } catch (err) {
    res.status(500).json({ error: 'Reordering failed', details: err.message });
  }
});

// ─── POWER TOOL: Bulk File Analyze (Sniff Test) ────────
app.post('/api/batch/analyze', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const results = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let columns = [];
      let sheets = [];

      if (ext === '.csv') {
        const content = fs.readFileSync(file.path, 'utf8');
        const firstLine = content.split('\n')[0];
        columns = firstLine.split(',').map(c => c.trim().replace(/"/g, ''));
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(file.path);
        sheets = workbook.worksheets.map(s => s.name);
        if (workbook.worksheets.length > 0) {
          const firstSheet = workbook.worksheets[0];
          const headerRow = firstSheet.getRow(1);
          headerRow.eachCell(cell => {
            columns.push(String(cell.value || ''));
          });
        }
      }
      results.push({ 
        filename: file.originalname, 
        path: file.path, 
        columns, 
        sheets 
      });
    }

    res.json({ files: results });
  } catch (err) {
    console.error('Batch Analyze Error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

// ─── POWER TOOL: Bulk File Execute (Python Hand-off) ───
app.post('/api/batch/execute', async (req, res) => {
  try {
    const { files, sheet_name, columns, output_format, mode, ai_instructions } = req.body;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files to process' });

    // The files array now contains full objects { path, name, columns, sheets }
    const filePaths = typeof files[0] === 'object' ? files.map(f => f.path) : files;
    let mapping = null;

    if (mode === 'ai' && ai_instructions) {
      if (typeof files[0] !== 'object' || !files[0].columns) {
         console.warn('AI Mapping requires full file objects with columns. Proceeding without mapping.');
      } else {
        const fileHeaders = files.map(f => `File: ${path.basename(f.path)}\nHeaders: ${f.columns.join(', ')}`).join('\n\n');
        const prompt = `You are DocJockey AI.
Analyze the following files and their column headers:

${fileHeaders}

User Instructions: "${ai_instructions}"

Task 1: Create a JSON mapping that renames matching semantic headers from each file into the unified headers requested by the user.
Task 2: Identify the exact list of final output columns the user wants to keep, based on their instructions. If they don't explicitly specify, include all unified and relevant columns.

Return ONLY valid JSON in this exact structure, where the top level keys in "mapping" are exactly the file basenames provided above:
{
  "mapping": {
    "filename.csv": {
      "original_header_1": "unified_header_A",
      "original_header_2": "unified_header_B"
    }
  },
  "columns_to_keep": ["unified_header_A", "unified_header_B"]
}
If a file doesn't need mapping, don't include it in "mapping". Do not include markdown code blocks, just raw JSON.`;

        try {
          const responseText = await callGemini([{ text: prompt }]);
          const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const aiResult = JSON.parse(cleanedText);
          mapping = aiResult.mapping || null;
          
          if (aiResult.columns_to_keep && Array.isArray(aiResult.columns_to_keep) && aiResult.columns_to_keep.length > 0) {
            // Override the columns array so the Python engine filters the output exactly as requested
            req.body.columns = aiResult.columns_to_keep; 
          }
        } catch (err) {
          console.warn('AI Mapping failed, proceeding without mapping', err);
        }
      }
    }

    const config = {
      files: filePaths,
      sheet_name: sheet_name || {},
      columns: req.body.columns || [],
      output_format: output_format || 'xlsx',
      output_filename: `Bulk_Merge_${Date.now()}`,
      mapping: mapping
    };

    const configPath = path.join(UPLOAD_DIR, `config_${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config));

    const scriptPath = path.join(__dirname, 'scripts/batch_processor.py');
    const pythonProcess = spawn(PYTHON_CMD, [scriptPath, configPath], {
      cwd: __dirname // Ensure script runs with backend/ as root
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

    pythonProcess.on('close', (code) => {
      // Cleanup config file
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

      if (code !== 0) {
        return res.status(500).json({ error: 'Python processing failed', details: errorOutput });
      }

      const successMatch = output.match(/SUCCESS_PATH: (.*)/);
      if (successMatch) {
         res.json({ downloadUrl: `/${successMatch[1]}` });
      } else {
         res.status(500).json({ error: 'Unexpected Python output', details: output });
      }
    });

  } catch (err) {
    console.error('Batch Execute Error:', err);
    res.status(500).json({ error: 'Execution failed', details: err.message });
  }
});

// ─── TOOL HELPER: Clean JSON Extraction ──────────────
const extractCleanJson = (raw) => {
  try {
    // Strip possible markdown code blocks
    const stripped = raw.replace(/```json\n?|```/g, '').trim();
    // Find first [ or { and last ] or }
    const firstBracket = stripped.indexOf('[');
    const firstBrace = stripped.indexOf('{');
    const first = (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) ? firstBracket : firstBrace;
    
    const lastBracket = stripped.lastIndexOf(']');
    const lastBrace = stripped.lastIndexOf('}');
    const last = (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) ? lastBracket : lastBrace;

    if (first === -1 || last === -1) throw new Error("No JSON found");
    const jsonStr = stripped.substring(first, last + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    // Aggressive line-by-line fallback for markdown pipe tables if AI fails JSON
    if (raw.includes('|')) {
      const lines = raw.split('\n').filter(l => l.includes('|') && !l.includes('---'));
      return lines.map(line => {
        const parts = line.split('|').map(s => s.trim()).filter(s => s);
        return parts.reduce((acc, p, i) => ({ ...acc, [`Col${i+1}`]: p }), {});
      });
    }
    throw e;
  }
};

// ─── TOOL HELPER: Deep Excel Value Resolver ──────────
const getDeepCellValue = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  
  let val = cell.value;

  // 1. Resolve Formula Results or Complex Objects
  if (typeof val === 'object' && val !== null) {
    if (val.result !== undefined) val = val.result;
    else if (val.text !== undefined) val = val.text;
    else if (Array.isArray(val.richText)) return val.richText.map(rt => rt.text).join('');
    else if (val.formula) return ''; // Formula with no cached result
  }

  // 2. Final Value Check (could be the result of step 1)
  if (!val && val !== 0 && val !== false) return '';

  // 3. Robust Date Detection (Native or ISO-like)
  if (val instanceof Date || (typeof val === 'object' && val.toISOString)) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      }
    } catch (e) {}
  }

  // 4. Default Stringification
  if (typeof val === 'object') return ''; // Avoid [object Object]
  return String(val);
};

// ─── PDF TOOL: PDF to Excel (High Fidelity) ────────────
app.post('/api/tools/pdf-to-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF or Image.' });
    const inputData = getMultimodalData(req.file.path);
    const prompt = `Act as a Visual Data Architect for Excel. 
    TASK: Extract ALL structured data from this document.
    
    STRATEGY:
    1. If you see a VERTICAL FORM (Label on left, Value on right, like "UTR Number: 123"), convert it into a 2-column row: ["UTR Number", "123"].
    2. If you see a HORIZONTAL TABLE (Grid with headers), extract it as objects.
    3. Return a unified JSON array of arrays or objects.
    
    RETURN ONLY a JSON array. 
    Example for vertical data: [["Label1", "Value1"], ["Label2", "Value2"]]
    Example for horizontal data: [{"Column1": "Val1", "Column2": "Val2"}]
    
    CRITICAL: Capture every single field. NO CONVERSATIONAL TEXT. ONLY RAW JSON.`;

    const aiText = await callGemini(
      [{ role: 'user', parts: [{ text: "Extract structured data from the attached file." }, inputData] }],
      prompt
    );

    const data = extractCleanJson(aiText);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NexGen_Structural_Export');
    
    if (data.length > 0) {
      // Check if data is array of objects (Horizontal Table)
      if (!Array.isArray(data[0]) && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        const hRow = worksheet.getRow(1);
        hRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FF1A1A1A' }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0B0B0' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF888888' } } };
        });
        hRow.height = 22;
        data.forEach(item => {
          worksheet.addRow(headers.map(h => {
            let val = item[h];
            return typeof val === 'string' ? val.replace(/\*\*\*/g, '').replace(/\*\*/g, '') : val;
          }));
        });
      } 
      // Array of Arrays (Vertical Form / Raw Rows)
      else {
        data.forEach(row => {
          const cleanRow = Array.isArray(row) 
            ? row.map(cell => typeof cell === 'string' ? cell.replace(/\*\*\*/g, '').replace(/\*\*/g, '') : cell)
            : [row];
          worksheet.addRow(cleanRow);
        });
      }
      
      worksheet.columns.forEach(column => { column.width = 30; });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=NexGen_Grid_Export.xlsx');
    res.send(buffer);
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('PDF-to-Excel Error:', err);
    res.status(500).json({ error: 'Excel conversion failed', details: err.message });
  }
});

// ─── PDF TOOL: Excel to PDF (High Fidelity Mirror) ───────
app.post('/api/tools/excel-to-pdf', upload.single('file'), async (req, res) => {
  try {
    const { sheets } = req.body; 
    if (!req.file) return res.status(400).json({ error: 'Please upload an Excel file.' });

    const workbook = new ExcelJS.Workbook();
    if (req.file.originalname.toLowerCase().endsWith('.csv') || req.file.mimetype === 'text/csv') {
      await workbook.csv.readFile(req.file.path);
    } else {
      await workbook.xlsx.readFile(req.file.path);
    }
    
    const targetNames = sheets ? sheets.split(',').map(s => s.trim().toLowerCase()) : [];
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    for (const worksheet of workbook.worksheets) {
      if (targetNames.length > 0 && !targetNames.includes(worksheet.name.trim().toLowerCase())) continue;

      // 1. Column & Row Density Check
      let usedCols = new Set();
      let maxRow = 0;
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        let rowHasContent = false;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const val = getDeepCellValue(cell);
          if (val && String(val).trim() !== '') {
            rowHasContent = true;
            usedCols.add(colNumber);
          }
        });
        if (rowHasContent) maxRow = Math.max(maxRow, rowNumber);
      });

      const activeCols = Array.from(usedCols).sort((a, b) => a - b);
      if (maxRow === 0 || activeCols.length === 0) continue; 

      let page = pdfDoc.addPage([1190, 842]);
      const { width, height } = page.getSize();
      let y = height - 40;
      const margin = 40;
      const availableWidth = width - (margin * 2);
      const colWidth = availableWidth / activeCols.length;
      const rowHeight = 22;

      const drawRow = (rowObj, isHeader = false) => {
        let x = margin;
        if (isHeader) {
          page.drawRectangle({ x, y: y - rowHeight, width: availableWidth, height: rowHeight, color: rgb(0.69, 0.69, 0.69) });
        }
        for (const c of activeCols) {
          const cell = rowObj.getCell(c);
          const val = getDeepCellValue(cell);
          const drawVal = String(val).substring(0, 60);

          page.drawRectangle({
            x, y: y - rowHeight,
            width: colWidth, height: rowHeight,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5
          });

          if (val && String(val).trim() !== '') {
            try {
              page.drawText(drawVal, {
                x: x + 5,
                y: y - (rowHeight / 1.5),
                size: 8,
                font: isHeader ? fontBold : font,
                color: rgb(0.1, 0.1, 0.1)
              });
            } catch(e) {}
          }
          x += colWidth;
        }
        y -= rowHeight;
      };

      // Header row
      drawRow(worksheet.getRow(1), true);

      // Data rows (starting from row 2)
      for (let r = 2; r <= maxRow; r++) {
        if (y < 60) {
          page = pdfDoc.addPage([1190, 842]);
          y = height - 40;
          drawRow(worksheet.getRow(1), true); // Repeat header
        }
        drawRow(worksheet.getRow(r));
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=NexGen_Excel_Mirror.pdf');
    res.send(Buffer.from(pdfBytes));
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('Excel-to-PDF Error:', err);
    res.status(500).json({ error: 'Excel to PDF conversion failed', details: err.message });
  }
});

// ─── TOOL HELPER: PDF Safe Text ──────────────────────
const sanitizeForPdf = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/[\u2011\u2012\u2013\u2014\u2015]/g, '-') // Hyphens/Dashes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")       // Single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')       // Double quotes
    .replace(/[\u2022\u2023\u2043\u204C\u204D]/g, '*') // Bullets
    .replace(/[^\x00-\x7F]/g, '');                     // Remove anything else non-ASCII for safety
};

// ─── PDF TOOL: Word to PDF (High Fidelity Mirror) ───────
app.post('/api/tools/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a Word file.' });

    // ─── 1. Extract Content locally via Mammoth ───
    const result = await mammoth.extractRawText({ path: req.file.path });
    const wordContent = result.value;

    const prompt = `Act as a Professional Document Architect. 
    Analyze the following Word document text and reconstruct its structural elements.
    
    DOCUMENT CONTENT:
    ${wordContent}
    
    TASK:
    1. Identify Headers (H1, H2).
    2. Identify regular Paragraphs.
    3. Identify Tables (if data is grouped in columns/rows).
    4. Group content in order.
    
    RETURN ONLY a JSON array of blocks:
    [
      { "type": "h1", "content": "Title" },
      { "type": "paragraph", "content": "..." },
      { "type": "table", "content": [["Row1Col1", "Row1Col2"], ["Row2Col1", "Row2Col2"]] }
    ]
    
    CRITICAL: NO CONVERSATIONAL TEXT. ONLY RAW JSON.`;

    const aiText = await callGemini(
      [{ role: 'user', parts: [{ text: "Analyze and reconstruct Word structure." }] }],
      prompt
    );

    const blocks = extractCleanJson(aiText);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([600, 842]);
    const { width, height } = page.getSize();
    let y = height - 40;
    const margin = 50;
    const availableWidth = width - (margin * 2);

    for (const block of blocks) {
      if (y < 60) {
        page = pdfDoc.addPage([600, 842]);
        y = height - 40;
      }

      const rawContent = typeof block.content === 'string' 
        ? block.content.replace(/\*\*\*/g, '').replace(/\*\*/g, '') 
        : block.content;
      
      const content = sanitizeForPdf(rawContent).replace(/\n/g, ' ').replace(/\r/g, ' ');

      if (block.type === 'h1' || block.type === 'h2') {
        const size = block.type === 'h1' ? 17 : 13;
        const color = block.type === 'h1' ? rgb(0.05, 0.2, 0.5) : rgb(0.1, 0.1, 0.1);
        page.drawText(String(content), { x: margin, y: y - size, size, font: fontBold, color });
        y -= (size + 15);
      } 
      else if (block.type === 'table') {
        const rows = Array.isArray(content) ? content : (Array.isArray(block.content) ? block.content : []);
        if (rows.length === 0) continue;
        
        const colCount = rows[0].length;
        const colWidth = availableWidth / Math.max(colCount, 1);
        const rowHeight = 22;

        for (const [rowIndex, row] of rows.entries()) {
          if (y < 60) { 
            page = pdfDoc.addPage([600, 842]); 
            page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
            y = height - 50; 
          }
          
          let x = margin;
          // Header tint
          if (rowIndex === 0) {
            page.drawRectangle({ x, y: y - rowHeight, width: availableWidth, height: rowHeight, color: rgb(0.97, 0.98, 1.0) });
          }

          for (const cell of row) {
            const rawCell = String(cell || '').replace(/\*\*\*/g, '').replace(/\*\*/g, '');
            const cellText = sanitizeForPdf(rawCell).substring(0, 45);
            
            page.drawRectangle({
              x, y: y - rowHeight,
              width: colWidth, height: rowHeight,
              borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5
            });

            page.drawText(cellText, {
              x: x + 6, y: y - (rowHeight / 1.5),
              size: 7.5, font: rowIndex === 0 ? fontBold : font,
              color: rowIndex === 0 ? rgb(0.05, 0.2, 0.4) : rgb(0.2, 0.2, 0.2)
            });
            x += colWidth;
          }
          y -= rowHeight;
        }
        y -= 15;
      } 
      else {
        // Paragraph with basic wrap
        const words = String(content).split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          if (font.widthOfTextAtSize(testLine, 9.5) > availableWidth) {
            page.drawText(line, { x: margin, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
            y -= 13.5;
            line = word;
            if (y < 50) { 
              page = pdfDoc.addPage([600, 842]); 
              page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
              y = height - 50; 
            }
          } else {
            line = testLine;
          }
        }
        page.drawText(line, { x: margin, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 20;
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=NexGen_Word_Mirror.pdf');
    res.send(Buffer.from(pdfBytes));
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error('Word-to-PDF Error:', err);
    res.status(500).json({ error: 'Word to PDF failed', details: err.message });
  }
});

// ─── Export conversation data as CSV ─────────────────────
app.get('/api/conversations/:id/export', async (req, res) => {
  try {
    const { format } = req.query;
    const result = await pool.query(
      'SELECT role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    const rows = result.rows;

    const jsonBlocks = [];
    for (const row of rows) {
      if (row.role === 'model') {
        // FLEXIBLE REGEX: Handles ```json, ```JSON, or just ``` with optional spaces/newlines
        const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
        let match;
        while ((match = regex.exec(row.content)) !== null) {
          try {
            const clean = match[1].trim();
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) jsonBlocks.push(...parsed);
            else jsonBlocks.push(parsed);
          } catch (e) {
            // Fallback: try to see if it's a markdown table if JSON parsing fails
            if (match[1].includes('|')) {
              const lines = match[1].split('\n').filter(l => l.includes('|') && !l.includes('---'));
              const tableData = lines.map(line => {
                const parts = line.split('|').map(s => s.trim()).filter(s => s);
                return parts.reduce((acc, p, i) => ({ ...acc, [`Column_${i+1}`]: p }), {});
              });
              if (tableData.length > 0) jsonBlocks.push(...tableData);
            }
          }
        }
      }
    }

    console.log(`[EXPORT DEBUG] Format: ${format}, JSON Blocks Found: ${jsonBlocks.length}`);

    // ─── Export: Excel (.xlsx) ───
    if (format === 'xlsx' && jsonBlocks.length > 0) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('OneStopDoc Extraction');
      const headers = Object.keys(jsonBlocks[0]);
      sheet.columns = headers.map(h => ({ header: h.toUpperCase(), key: h }));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      sheet.addRows(jsonBlocks);
      sheet.columns.forEach(column => {
        let maxLen = column.header.length;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const len = cell.value ? cell.value.toString().length : 0;
          if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(maxLen + 2, 50);
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=OneStopDoc_Export_${Date.now()}.xlsx`);
      return workbook.xlsx.write(res).then(() => res.end());
    }

    // ─── Export: Word (.docx) ───
    if (format === 'docx') {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ text: "NexGen AI Extraction Report", heading: HeadingLevel.TITLE }),
            new Paragraph({ text: `Project: ${req.params.id}`, spacing: { after: 200 } }),
            new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, spacing: { after: 400 } }),
            ...rows.map(msg => {
              // Clean content by removing the code blocks but keeping the data
              const cleanContent = msg.content.replace(/```(?:json)?[\s\S]*?```/gi, '[Table Data Below]');
              
              const paragraphs = [
                new Paragraph({
                  children: [
                    new TextRun({ text: msg.role === 'user' ? "YOU: " : "AI: ", bold: true, color: msg.role === 'user' ? "8B5CF6" : "0EA5E9" }),
                    new TextRun({ text: cleanContent })
                  ],
                  spacing: { before: 200 }
                })
              ];

              // If it's the model and has structured data, add it as a summary text
              if (msg.role === 'model' && jsonBlocks.length > 0) {
                 // We could add a real Word table here in the future, 
                 // for now we keep the report format clear.
              }

              return paragraphs;
            }).flat()
          ]
        }]
      });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=NexGen_Report_${Date.now()}.docx`);
      return res.send(buffer);
    }

    // ─── Export: PDF (.pdf) ───
    if (format === 'pdf' && jsonBlocks.length > 0) {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let page = pdfDoc.addPage([1190, 842]); // A4 Landscape
      const { width, height } = page.getSize();
      let y = height - 60;
      const margin = 40;
      const availableWidth = width - (margin * 2);
      
      const headers = Object.keys(jsonBlocks[0]);
      const colWidth = availableWidth / headers.length;
      const rowHeight = 22;

      const drawRow = (data, isHeader = false) => {
        let x = margin;
        if (isHeader) {
          page.drawRectangle({ x, y: y - rowHeight, width: availableWidth, height: rowHeight, color: rgb(0.95, 0.95, 0.95) });
        }
        headers.forEach(h => {
          const val = isHeader ? h.toUpperCase() : String(data[h] || '');
          const drawVal = val.substring(0, 50);
          page.drawRectangle({
            x, y: y - rowHeight, width: colWidth, height: rowHeight,
            borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5
          });
          page.drawText(drawVal, {
            x: x + 5, y: y - (rowHeight / 1.5), size: 8,
            font: isHeader ? fontBold : font, color: rgb(0.1, 0.1, 0.1)
          });
          x += colWidth;
        });
        y -= rowHeight;
      };

      drawRow({}, true);
      for (const block of jsonBlocks) {
        if (y < 60) {
          page = pdfDoc.addPage([1190, 842]);
          y = height - 60;
          drawRow({}, true);
        }
        drawRow(block);
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=DocJockey_Export_${Date.now()}.pdf`);
      return res.send(Buffer.from(pdfBytes));
    }

    // Default fallback
    res.json({ messages: rows, structured_data: jsonBlocks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dashboard stats ─────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const q1 = pool.query('SELECT COUNT(*) as count FROM conversations');
    const q2 = pool.query('SELECT COUNT(*) as count FROM documents');
    const q3 = pool.query('SELECT COUNT(*) as count FROM messages');
    
    const [c1, c2, c3] = await Promise.all([q1, q2, q3]);
    
    res.json({
      total_conversations: parseInt(c1.rows[0].count),
      total_documents: parseInt(c2.rows[0].count),
      total_messages: parseInt(c3.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export Routes ────────────────────────────────────────

// Export as Excel (.xlsx)
app.post('/api/export/excel', async (req, res) => {
  try {
    const { data, filename = 'docjockey_export' } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DocJockey AI';
    const sheet = workbook.addWorksheet('Extracted Data');
    const headers = Object.keys(data[0]);

    // Header row styling
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF1A1A1A' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0B0B0' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF888888' } } };
    });
    headerRow.height = 22;

    // Data rows
    data.forEach((row, i) => {
      const values = headers.map(h => {
        const v = row[h];
        return (v === null || v === undefined) ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
      });
      const dataRow = sheet.addRow(values);
      dataRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle' };
      });
    });

    // Auto column widths
    sheet.columns.forEach((col, idx) => {
      const maxLen = Math.max(headers[idx]?.length || 10, ...data.map(r => String(r[headers[idx]] ?? '').length));
      col.width = Math.min(Math.max(maxLen + 4, 12), 50);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export as Word (.docx)
app.post('/api/export/word', async (req, res) => {
  try {
    const { data, filename = 'docjockey_export' } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    const headers = Object.keys(data[0]);

    const headerCells = headers.map(h => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h.toUpperCase(), bold: true, color: 'FFFFFF', size: 20 })], })],
      shading: { fill: 'E63639' },
      verticalAlign: VerticalAlign.CENTER,
    }));

    const dataRows = data.map((row, i) => new TableRow({
      children: headers.map(h => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(row[h] ?? ''), size: 18 })] })],
        shading: { fill: i % 2 === 0 ? 'F5F5F5' : 'FFFFFF' },
      })),
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: 'DocJockey AI — Extracted Data', bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 18, color: '888888' })] }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export as PDF (text-based table)
app.post('/api/export/pdf', async (req, res) => {
  try {
    const { data, filename = 'docjockey_export' } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    const headers = Object.keys(data[0]);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 8;
    const rowHeight = 18;
    const marginX = 30;
    const marginY = 40;
    const colWidth = Math.min(Math.floor((595 - marginX * 2) / headers.length), 120);
    const pageWidth = 595;

    let page = pdfDoc.addPage([pageWidth, 842]);
    let y = 842 - marginY;

    // Title
    page.drawText('DocJockey AI — Extracted Data', { x: marginX, y, font: fontBold, size: 14, color: rgb(0.9, 0.21, 0.22) });
    y -= 24;
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: marginX, y, font, size: 9, color: rgb(0.5, 0.5, 0.5) });
    y -= 20;

    const drawRow = (rowData, isBold = false, bgColor = null) => {
      if (y < marginY + rowHeight) {
        page = pdfDoc.addPage([pageWidth, 842]);
        y = 842 - marginY;
      }
      if (bgColor) page.drawRectangle({ x: marginX, y: y - 4, width: colWidth * headers.length, height: rowHeight, color: bgColor });
      rowData.forEach((val, idx) => {
        const text = String(val ?? '').slice(0, 20);
        page.drawText(text, { x: marginX + idx * colWidth + 4, y: y + 2, font: isBold ? fontBold : font, size: fontSize, color: isBold ? rgb(1,1,1) : rgb(0.15,0.15,0.15) });
      });
      y -= rowHeight;
    };

    drawRow(headers, true, rgb(0.9, 0.21, 0.22));
    data.forEach((row, i) => {
      drawRow(headers.map(h => row[h]), false, i % 2 === 0 ? rgb(0.96, 0.96, 0.96) : null);
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve React Frontend (Rectified) ────────────────────
const FRONTEND_DIR = path.resolve(process.cwd(), 'frontend', 'dist');
console.log(`📦 [RECTIFIED] Serving from: ${FRONTEND_DIR}`);

app.use(express.static(FRONTEND_DIR));

// Failsafe catch-all for SPA
app.get(/^(?!\/api\/|\/assets\/).*/, (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  res.sendFile(indexPath);
});

/**
 * PHASE 2: Executive Reporting Engine (Rectified & Isolated)
 * Synthesizes chat history into a high-fidelity audit report.
 */
const EXECUTIVE_REPORT_PROMPT = `You are the Lead Data Analyst for an Enterprise Intelligence Suite.
Your task is to synthesize a high-fidelity Executive Analysis Report based on the provided document context and chat history.

STRUCTURE:
1. Executive Analysis: High-level purpose and scope of this investigation.
2. Data Description: Provide a detailed profile of the data (what it is about, record counts, active columns, and the specific business context).
3. Key Findings: Present mission-critical insights derived from the data. 
   - Embed Mermaid.js visualizations (pie charts, bar charts, or xy charts) ONLY for the most important findings. 
   - Do NOT generate plots for every variable; focus only on the core results.
4. Strategic Insights: Potential risks or opportunities identifies in the documents.
5. Final Verdict: Professional recommendation.

CRITICAL RULES:
- Use "Analysis" terminology throughout. NEVER use "Audit".
- NEVER mention "NexGen" or "DocJockey" in the body text or headers. Keep the text brand-neutral.
- Use bold headers and professional enterprise-grade tone.
- Use Markdown for the content to ensure compatibility with our processor.`;

const GET_BRANDED_HTML = (contentHtml) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Executive Analysis Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // --- AUTO-RENDERER FOR MARKDOWN CODE BLOCKS ---
            // Finds markdown-style mermaid code blocks and converts them for rendering
            document.querySelectorAll('pre code.language-mermaid').forEach(block => {
                const pre = block.parentElement;
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.textContent = block.textContent;
                pre.replaceWith(mermaidDiv);
            });

            mermaid.initialize({ 
                startOnLoad: true, 
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#e63639',
                    primaryTextColor: '#fff',
                    primaryBorderColor: '#e63639',
                    lineColor: '#e63639',
                    secondaryColor: '#1da5a2',
                    tertiaryColor: '#1c1517'
                }
            });
        });
    </script>

    <style>
        :root {
            --primary: #e63639;
            --secondary: #1da5a2;
            --bg: #0b0c10;
            --text: #e2e8eb;
            --surface: #1c1517;
        }
        body { 
            font-family: 'Outfit', sans-serif; 
            line-height: 1.6; 
            color: var(--text); 
            background: var(--bg); 
            margin: 0;
            padding: 40px;
            position: relative;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 15vw;
            color: rgba(255, 255, 255, 0.03);
            font-weight: 900;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            z-index: 1000;
            letter-spacing: 0.5em;
        }
        .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: var(--surface);
            padding: 60px;
            border-radius: 24px;
            box-shadow: 0 40px 100px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.05);
            position: relative;
            z-index: 1;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 60px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 30px;
        }
        .analysis-badge {
            background: var(--primary);
            color: white;
            padding: 8px 16px;
            font-weight: 900;
            border-radius: 8px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .report-label {
            font-size: 10px;
            font-weight: 900;
            color: rgba(255,255,255,0.3);
            text-transform: uppercase;
            letter-spacing: 4px;
        }
        h1, h2, h3 { color: white; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; }
        h1 { font-size: 36px; margin: 0; }
        h2 { font-size: 20px; color: var(--primary); margin-top: 60px; margin-bottom: 20px; border-left: 4px solid var(--primary); padding-left: 15px; }
        p, li { font-size: 16px; color: rgba(255,255,255,0.7); margin-bottom: 1.5em; }
        li { margin-left: 20px; }
        .footer {
            margin-top: 80px;
            text-align: center;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 40px;
            font-size: 10px;
            font-weight: 900;
            color: rgba(255,255,255,0.3);
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(0,0,0,0.2); border-radius: 12px; overflow: hidden; }
        th { background: rgba(255,255,255,0.05); color: var(--primary); text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; font-weight: 900; }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 14px; }
        .mermaid { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.05); }
    </style>
</head>
<body>
    <div class="watermark">DOCJOCKEY</div>
    <div class="container">
        <div class="header">
            <div>
                <div class="report-label">Strategic Intelligence Result</div>
                <h1>Executive Analysis Report</h1>
            </div>
        
        <div class="content">
            ${contentHtml}
        </div>

        <div class="footer">
            Generated by DocJockey AI • Enterprise-Grade Intelligence • Confidential
        </div>
    </div>
</body>
</html>
`;

app.post('/api/generate-reporting-executive', async (req, res) => {
  const { conversation_id } = req.body;
  
  if (!conversation_id) return res.status(400).json({ error: 'Conversation ID required' });

  try {
    // 1. Re-hydrate Context from DB
    const msgs = await pool.query('SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversation_id]);
    const docs = await pool.query('SELECT extracted_text, original_name FROM documents WHERE conversation_id = $1', [conversation_id]);

    if (msgs.rows.length === 0) return res.status(404).json({ error: 'No conversation history found' });

    // 2. Synthesize Context
    let context = "ANALYSIS CONTEXT:\n";
    docs.rows.forEach(d => {
      context += `[DOCUMENT: ${d.original_name}]\n${d.extracted_text?.slice(0, 5000)}\n\n`;
    });
    
    context += "CHAT HISTORY:\n";
    msgs.rows.forEach(m => {
      context += `${m.role.toUpperCase()}: ${m.content}\n`;
    });

    // 3. Call Gemini for Synthesis
    const reportMarkdown = await callGemini(
      [{ text: context }], 
      EXECUTIVE_REPORT_PROMPT
    );

    // 4. Render to Branded HTML
    const contentHtml = markdownIt.render(reportMarkdown);
    const fullHtml = GET_BRANDED_HTML(contentHtml);

    res.json({
      markdown: reportMarkdown,
      html: fullHtml,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Report Synthesis Error:', err);
    res.status(500).json({ error: 'Failed to synthesize report', details: err.message });
  }
});

// ─── Start Server ────────────────────────────────────────
const startServer = async () => {
  try {
    // Ensure DB is ready before starting
    await initDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 DocJockey AI v1.0 - Ready for Business`);
      console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
      console.log(`📡 Database: PostgreSQL (Supabase Connected)`);
      console.log(`📂 Storage: Local FileSystem (Ephemeral: /uploads)`);
      console.log(`🧠 AI Models: Extraction engine ready\n`);
    });
  } catch (err) {
    console.error('💥 FATAL ERROR: Deployment failed due to database connection issues.');
    console.error(err);
    process.exit(1);
  }
};

startServer();
