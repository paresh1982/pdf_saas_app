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


- **TITLE EXTRACTION**: Analyze the chat history to see if the user specified a custom title for the report (e.g., 'Set title to Q1 Audit'). 
- If found, start your response with '# TITLE: [Custom Title]'. 
- If no title is requested, start with '# TITLE: Executive Analysis Report'.

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
    if (contents.length > 0) {
        contents[contents.length - 1].parts[0].text += `\n\n### Available Data Files (Current Schema Context):\n${filesContext}`;
    }

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
    
    if (pythonCode.length === 0) {
       // Fallback
       const lines = aiText.split('\n');
       const hasPandas = lines.some(l => l.includes('import pandas') || l.includes('pd.'));
       const isJSON = aiText.trim().startsWith('{') && aiText.trim().endsWith('}');
       
       if (hasPandas) pythonCode = aiText.trim();
       else if (isJSON) pythonCode = `import json\nprint(json.dumps(${aiText.trim()}))`;
       else pythonCode = `print("""${aiText.replace(/"/g, '\\"')}""")`;
    }

    // 3.5 Auto-correct paths
    if (docs && docs.length > 0) {
       for (const doc of docs) {
           const correctPath = path.join(__dirname, 'uploads', doc.filename).replace(/\\/g, '/');
           const nameEscaped = doc.original_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           const regex = new RegExp(`r?['"][^'"]*?${nameEscaped}['"]`, 'gi');
           pythonCode = pythonCode.replace(regex, `r"${correctPath}"`);
       }
    }

    // 4. Execute
    const tempScriptPath = path.join(__dirname, 'scripts', `temp_analysis_${Date.now()}.py`);
    const bootstrap = `import sys, os\nsys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'python_libs')))\n\n`;
    fs.writeFileSync(tempScriptPath, bootstrap + pythonCode);

    const execPromise = new Promise((resolve) => {
       exec(`${PYTHON_CMD} "${tempScriptPath}"`, { timeout: 45000 }, (error, stdout, stderr) => {
           if (error) {
               resolve(`❌ **Python Execution Error**:\n\`\`\`text\n${stderr || error.message}\n\`\`\``);
           } else {
                let outputText = (stdout || '').trim();

                // --- TOTAL TECHNICAL PURGE ---
                const magicSummaryKeyword = "[STRATEGIC_OVERVIEW_REQUEST]";
                if (message && message.includes(magicSummaryKeyword)) {
                    let finalProse = outputText;
                    try {
                        const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            finalProse = parsed.summary || parsed.t || outputText;
                            if (typeof finalProse === 'object') finalProse = finalProse.summary || finalProse.t || JSON.stringify(finalProse);
                        }
                    } catch (e) {}
                    resolve(`🔬 **Data Analysis Result**:\n\n${finalProse.replace(/\`\`\`json[\s\S]*?\`\`\`/gi, '').replace(/\`\`\`[\s\S]*?\`\`\`/gi, '').trim()}`);
                    return; 
                }

                // --- INTEGRATED SANITIZATION & INTENT DETECTION ---
                try {
                    const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                    if (jsonMatch) {
                        let parsed = JSON.parse(jsonMatch[0]);
                        parsed = sanitizeAnalysisResponse(parsed, docs);
                        
                        const visualKeywords = ['plot', 'plotting', 'graph', 'graphing', 'chart', 'visual', 'visualise', 'visualize', 'trend', 'distribution', 'scatter', 'bar', 'histogram', 'line', 'view relationship', 'relationship', 'correlation', 'compare'];
                        const userPrompt = (message || "").toLowerCase();
                        const hasVisualIntent = visualKeywords.some(k => userPrompt.includes(k));
                        
                        if (hasVisualIntent) parsed.primaryView = "chart";
                        else if (!parsed.primaryView) parsed.primaryView = "table"; 
                        
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
    try { fs.unlinkSync(tempScriptPath); } catch (e) {}

    await pool.query(
        'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
        [convId, 'model', finalResult, JSON.stringify([{ type: 'python_code', code: pythonCode }])]
    );

    res.json({ response: finalResult, conversation_id: convId, python_code: pythonCode });
  } catch (err) {
    res.status(500).json({ error: 'Analysis execution failed', details: err.message });
  }
});

// ─── CHAT ENDPOINT ──────────────────────────
app.post('/api/chat', upload.array('files', 10), async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    let convId = conversation_id;
    if (!convId) {
      convId = 'conv_' + Date.now();
      await pool.query('INSERT INTO conversations (id, user_id, title, type) VALUES ($1, $2, $3, $4)', [convId, req.userId, message?.substring(0, 60), 'chat']);
    }
    const uploadedDocs = [];
    if (req.files) {
      for (const file of req.files) {
        await pool.query('INSERT INTO documents (conversation_id, user_id, filename, original_name, file_size) VALUES ($1, $2, $3, $4, $5)', [convId, req.userId, file.filename, file.originalname, file.size]);
      }
    }
    const { rows: history } = await pool.query('SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [convId]);
    const geminiHistory = history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.content }] }));
    const aiText = await callGemini([...geminiHistory, { role: 'user', parts: [{ text: message }] }]);
    await pool.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [convId, 'user', message]);
    await pool.query('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [convId, 'model', aiText]);
    res.json({ response: aiText, conversation_id: convId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 DocJockey Backend running on port ${PORT}`);
  initDB();
});
