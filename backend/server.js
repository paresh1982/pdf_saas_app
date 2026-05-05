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

- **TITLE EXTRACTION**: Analyze the chat history to see if the user specified a custom title for the report (e.g., "Set title to Q1 Audit"). 
- If found, start your response with \`# TITLE: [Custom Title]\`. 
- If no title is requested, start with \`# TITLE: Executive Analysis Report\`.

CRITICAL RULES:
- Use "Analysis" terminology throughout. NEVER use "Audit".
- NEVER mention "NexGen" or "DocJockey" in the body text or headers. Keep the text brand-neutral.
- Use bold headers and professional enterprise-grade tone.
- Use Markdown for the content to ensure compatibility with our processor.`;

const GET_BRANDED_HTML = (contentHtml, title = 'Executive Analysis Report') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
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
        h2 { font-size: 20px; color: var(--primary); margin-top: 40px; border-left: 4px solid var(--primary); padding-left: 15px; }
        p, li { font-size: 16px; color: rgba(255,255,255,0.7); }
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
                <h1>${title}</h1>
            </div>
            <div class="analysis-badge">Confidential Analysis</div>
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
/**
 * Repairs truncated or malformed JSON strings by closing open structures.
 */
const repairJson = (str) => {
  if (!str) return str;
  let json = str.trim();
  
  // Find start of JSON structure
  const startIdx = json.search(/[\[\{]/);
  if (startIdx === -1) return str;
  json = json.substring(startIdx);

  let stack = [];
  let inString = false;
  let escaped = false;
  let repaired = "";

  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    repaired += c;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === '\\') {
      escaped = true;
      continue;
    }

    if (c === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  // Repair
  if (inString) repaired += '"';
  
  // Remove trailing comma if it exists before closing
  repaired = repaired.trim().replace(/,\s*$/, "");

  // Close all open braces/brackets
  while (stack.length > 0) {
    const top = stack.pop();
    repaired += (top === '{' ? '}' : ']');
  }

  return repaired;
};

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

You can analyze ANY type of document: PDFs, Excel/CSV spreadsheets, images, invoices, contracts, white papers, 
technical manuals, lab reports, resumes, cheat sheets, academic papers, and more.

### TABULAR EXTRACTION PROTOCOL (CRITICAL)
When the user asks to "build a table", "extract data", or "analyze items":

1. **ZERO PROSE (Extraction Only)**: If the request is a pure data extraction (e.g., "Extract all"), do NOT add intros or apologies. If the user explicitly asks a question or for an explanation ALONGSIDE the table, provide the JSON block FIRST, followed by your explanation below it.

2. **PERSISTENCE GUARANTEE**: If a value (like "Date", "Invoice #", or "Vendor") appears only once at the top of a page but applies to a table below it, YOU MUST REPEAT that value for every row in the JSON. 
   - **ZERO BLANK POLICY**: No row should have an empty "Date" if a date is detectable on the page.

3. **FULL DATASET EXTRACTION**: If the source has 365 rows, YOU MUST OUTPUT 365 ROWS. Never truncate, never summarize, and never skip data.

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

9. **ROOT ARRAY ONLY**: Your output MUST starting with [ and end with ]. NEVER wrap your response in a root object like { "data": ... }.

8. **AI-NATIVE FENCING (CRITICAL)**: You MUST ALWAYS wrap your JSON output in triple backticks ( \`\`\`json ). This applies even if you are analyzing Excel or CSV files. NEVER output raw JSON without backticks.

### CONVERSATIONAL RULES
- Respond helpfully and concisely.
- If asked for a summary, provide a bulleted list of key takeaways.
- If mixed content, provide both JSON and a short summary.
- Never refuse to analyze a document.`;


const BATCH_SYSTEM_PROMPT = `You are DocJockey AI - specialized in MULTI-FILE HARMONIZATION.
The user has uploaded multiple documents (PDFs, Excel/CSV, or Images). Your primary goal is to synthesize data across ALL files into a single, cohesive intelligence report.

### BATCH EXTRACTION RULES:
1. **UNIFIED OUTPUT**: If the user asks for a table or data extraction, YOU MUST merge line items from ALL documents into one single JSON array.
2. **SOURCE TRACKING**: Every row in your JSON MUST have a "Source File" column indicating which filename that row belongs to.
3. **TABULAR CONSISTENCY**: Standardize column names across all files so merging is seamless.
4. **CROSS-FILE SUMMARY**: In your summary after the JSON block, highlight trends, outliers, or discrepancies found between the files.

5. **AI-NATIVE FENCING (CRITICAL)**: You MUST ALWAYS wrap your JSON output in triple backticks ( \`\`\`json ). NEVER output raw JSON without backticks. This ensures the UI can render the interactive table.

Follow all JSON fencing and formatting rules from the standard SYSTEM_PROMPT.`;

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

    let excelText = `[FULL DOCUMENT DATA: ${file.originalname}]\n`;
    workbook.eachSheet(sheet => {
      excelText += `--- SHEET: ${sheet.name} ---\n`;
      // PROCESS ALL ROWS - REMOVE ANY 5-ROW PREVIEW LIMITS
      sheet.eachRow((row, rowNum) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
        // Clean values to avoid JSON breakage
        const cleanValues = values.map(v => (v === null || v === undefined) ? "" : String(v).replace(/\|/g, " "));
        excelText += `Row ${rowNum}: | ${cleanValues.join(' | ')} |\n`;
      });
      excelText += `\n`;
    });
    return { text: excelText };
  }
 else if (isWord) {
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
  // Determine if this is a high-fidelity extraction request (Master Extractor)
  const isExtractionRequest = (customSystemPrompt || SYSTEM_PROMPT).includes('TABULAR EXTRACTION PROTOCOL');
  const userMessage = contents[contents.length - 1]?.parts?.[0]?.text?.toLowerCase() || "";
  const isTableIntent = userMessage.includes('table') || userMessage.includes('extract') || userMessage.includes('all rows');

  // --- COST-OPTIMIZER QUEUE: Ascending Price/Intelligence ---
  let models = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview'
  ];

  // FORCE PRO MODELS for Master Extractor tasks to avoid Flash's "concise" summarization
  if (isExtractionRequest && isTableIntent) {
    console.log(`🚀 [Master Extractor] Extraction Intent Detected. Prioritizing Pro models for high-fidelity output.`);
    models = [
      'gemini-2.5-pro',
      'gemini-3.1-pro-preview',
      'gemini-2.5-flash'
    ];
  }

  let systemInstruction = (customSystemPrompt || SYSTEM_PROMPT);
  
  if (isTableIntent) {
    systemInstruction += `\n\n### DYNAMIC TOKEN COMPRESSION (FOR 100+ ROWS)
If the dataset is large (100+ rows), YOU MUST use short JSON keys to fit within the token limit.
1. The FIRST element in your JSON array must be a mapping object with the key "_map".
   Example: [{"_map": {"d": "Date", "desc": "Description", "amt": "Total Amount"}}, {"d": "2025-01-01", ...}]
2. Use these short keys for all subsequent rows.
3. Choose 1-3 character keys that make sense for the current document's headers.

CRITICAL: YOU MUST EXTRACT EVERY SINGLE ROW. DO NOT TRUNCATE.`;
  }

  for (let attempt = 0; attempt < models.length; attempt++) {
    const modelName = models[attempt];
    try {
      let result;
      // Increase output tokens for Pro models to handle larger tables
      const maxTokens = modelName.includes('pro') ? 20000 : 8192;
      
      if (typeof ai.getGenerativeModel === 'function') {
        const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
        result = await model.generateContent({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 } });
      } else {
        result = await ai.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction, maxOutputTokens: maxTokens }
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
    const { message, conversation_id, uploadMode } = req.body;
    let convId = conversation_id;
    const cleanedMessage = message?.replace('[STRATEGIC_OVERVIEW_REQUEST] ', '') || message || '';

    if (!convId) {
      convId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const title = 'Data Analysis: ' + (cleanedMessage.substring(0, 40) || 'New Session');
      await pool.query(
        'INSERT INTO conversations (id, user_id, title, type) VALUES ($1, $2, $3, $4)',
        [convId, req.userId, title, 'analysis']
      );
    }
    
    await pool.query(
        'INSERT INTO messages (conversation_id, role, content, attachments) VALUES ($1, $2, $3, $4)',
        [convId, 'user', cleanedMessage, JSON.stringify((req.files || []).map(f => f.originalname))]
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
      filesContext += `File: ${doc.original_name}\nInternal Path: ${filePath}\n\n`;
    }

    const systemPrompt = `You are a world-class Data Analyst. Turn the uploaded CSV into high-fidelity visual and strategic intelligence.

STRICT RULES:
1. ONLY return Python code inside a single triple-backtick python block.
2. NEVER use print(df.head()) or print(df.head().to_string()). NEVER print raw dataframe rows. This pollutes the output.
3. USE the exact file paths provided. Do not guess paths.
4. NumPy 2.0+: NEVER use np.float_, np.bool_, np.int_. Use np.float64, np.int64, or native Python float/int.
5. Cast all values before json.dumps() to avoid serialization errors.

VISUALIZATION SELECTION � DEFAULT TO TABLE DATA:
  - ALWAYS set primaryView: "table" unless the user explicitly uses charting keywords like "plot", "chart", "visualize", "graph", "trend", "distribution", "boxplot", or "scatter".
  - If charting keywords are present: Set primaryView: "chart" AND provide both tableData and chartConfig.
  - If no charting keywords: Set primaryView: "table" AND provide tableData (the calculation results).
  - Summary Mandatory: "summarize / describe / what is this data" -> Force primaryView: "table".
- NEVER default to boxplot for simple average/count/ranking questions.

CHART REQUIREMENTS:
- BAR: data = [{"label": "GroupName", "value": 28.79}, ...]. xAxisKey="label", yAxisKey="value".
- BOXPLOT: data = [{"group": "Name", "min": v, "q1": v, "median": v, "q3": v, "max": v}, ...].
- SCATTER: data = list of row dicts with x, y, and optional groupByKey columns.
- DENSITY: data = ~50 KDE points [{"x": val, "y": density}, ...]. Use scipy.stats.gaussian_kde.
- Always include "xAxisLabel" and "yAxisLabel" in chartConfig.
- All numbers: exactly 2 decimal places. Use float(round(x, 2)).

SUMMARY RULES:
- The "summary" field MUST directly answer the user question in the FIRST sentence.
- Example: "The average MPG of modern ICE cars is 28.79."
- Then add 1-2 paragraphs of interpretation/context.
- Do NOT include a Metadata Inventory section unless the user explicitly asks.

OUTPUT SCHEMA � Python code must print exactly this JSON:
{
    "type": "multiview",
    "summary": "Direct answer + brief interpretation...",
    "primaryView": "bar|scatter|boxplot|line|table",
    "tableData": [{"col": val, ...}],
    "chartConfig": {
        "type": "bar|scatter|boxplot|line",
        "data": [...],
        "xAxisKey": "label",
        "yAxisKey": "value",
        "xAxisLabel": "Human Readable",
        "yAxisLabel": "Human Readable",
        "groupByKey": "optional_group_col"
    }
}

REFER to previous messages for context if the user asks a follow-up question.`;

    // 2.5 Re-hydrate Conversation History (Crucial for Contextual Follow-ups)
    const { rows: history } = await pool.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [convId]
    );
    const geminiHistory = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

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

                // --- MAGIC SUMMARY PATH (Strategic Overview) ---
                const isMagicSummary = message && (
                    message.includes("[STRATEGIC_OVERVIEW_REQUEST]") ||
                    message.includes("Briefly summarize what this data is about")
                );
                if (isMagicSummary) {
                    let finalProse = outputText;
                    try {
                        const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                        if (jsonMatch) {
                            // Sanitize Python-specific non-JSON values before parsing
                            const safeJson = jsonMatch[0]
                                .replace(/:\s*NaN\b/g, ': null')
                                .replace(/:\s*Infinity\b/g, ': null')
                                .replace(/:\s*-Infinity\b/g, ': null');
                            const parsed = JSON.parse(safeJson);
                            finalProse = parsed.summary || parsed.t || outputText;
                            if (typeof finalProse === 'object') finalProse = finalProse.summary || finalProse.t || JSON.stringify(finalProse);
                        }
                    } catch (e) {
                        console.error('Magic summary JSON parse failed:', e.message);
                        // Fallback: try to extract summary field with regex
                        const summaryMatch = outputText.match(/"summary"\s*:\s*"([\s\S]*?)(?<!\\)"/);
                        if (summaryMatch) finalProse = summaryMatch[1].replace(/\\n/g, '\n');
                    }

                    // Safety guard: if finalProse still looks like raw JSON, use a fallback
                    if (typeof finalProse === 'string' && (finalProse.trim().startsWith('{') || finalProse.trim().startsWith('['))) {
                        finalProse = 'Dataset loaded successfully. Please ask a specific question to begin analysis.';
                    }

                    const scrubbedProse = (typeof finalProse === 'string' ? finalProse : JSON.stringify(finalProse))
                        .replace(/```json[\s\S]*?```/gi, '')
                        .replace(/```[\s\S]*?```/gi, '')
                        .replace(/r?\/opt\/render\/project\/src\/backend\/uploads\/[0-9-]+[._]([a-zA-Z0-9.-]+)/gi, '$1')
                        .replace(/r?\/opt\/render\/project\/src\/backend\/uploads\//gi, '')
                        .replace(/[0-9]{10,}-[0-9]{5,}[._]/g, '')
                        .trim();

                    resolve(scrubbedProse);
                    return;
                }

                // --- NORMAL QUESTION PATH (Reference: 7e8fe36) ---
                try {
                    const jsonMatch = outputText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const safeJsonStr = jsonMatch[0]
                            .replace(/:\s*NaN\b/g, ": null")
                            .replace(/:\s*Infinity\b/g, ": null")
                            .replace(/:\s*-Infinity\b/g, ": null");
                        let parsed = JSON.parse(safeJsonStr);
                        parsed = sanitizeAnalysisResponse(parsed, docs);

                        const visualKeywords = ['plot', 'plotting', 'graph', 'graphing', 'chart', 'visual', 'visualise', 'visualize', 'trend', 'distribution', 'scatter', 'bar', 'histogram', 'line', 'view relationship', 'relationship', 'correlation', 'compare'];
                        const userPrompt = (message || "").toLowerCase();
                        const hasVisualIntent = visualKeywords.some(k => userPrompt.includes(k));

                        if (hasVisualIntent) parsed.primaryView = "chart";
                        else if (!parsed.primaryView) parsed.primaryView = "table";

                        const cleanJson = JSON.stringify(parsed, null, 2);
                        // Isolate JSON at the very end with clear delimiters to prevent leakage
                        outputText = outputText.replace(jsonMatch[0], "").trim() + `\n\n\`\`\`json\n${cleanJson}\n\`\`\`\n`;
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

// ─── EXECUTIVE REPORTING ENDPOINT (Phase 2 - Concrete Resilience) ──────────
// Triple-mounted to bridge proxy/routing inconsistencies across environments.
app.post(['/api/generate-reporting-executive', '/api/reporting-executive', '/generate-reporting-executive'], async (req, res) => {
  try {
    const { conversation_id } = req.body;
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

    // 1. Fetch History
    const { rows: history } = await pool.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversation_id]
    );

    // 2. Fetch Active Documents
    const { rows: docs } = await pool.query(
      'SELECT filename, original_name FROM documents WHERE conversation_id = $1',
      [conversation_id]
    );

    let docContext = "";
    for (const doc of docs) {
      const filePath = path.join(__dirname, 'uploads', doc.filename);
      docContext += `File: ${doc.original_name}\nInternal Path: ${filePath}\n\n`;
    }

    const geminiHistory = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    // Construct synthesis prompt
    const synthesisContents = [
      ...geminiHistory,
      {
        role: 'user',
        parts: [{ 
          text: `GENERATE EXECUTIVE ANALYSIS REPORT. 
                 DOCUMENT CONTEXT:
                 ${docContext}
                 
                 CHRONOLOGICAL CONTEXT:
                 Previously, we discussed the above documents. 
                 Use the EXECUTIVE_REPORT_PROMPT rules to synthesize a final overview. 
                 Return ONLY high-fidelity Markdown.` 
        }]
      }
    ];

    console.log(`🚀 [REPORT] Synthesizing executive report for Conv: ${conversation_id}...`);
    const reportMarkdown = await callGemini(synthesisContents, EXECUTIVE_REPORT_PROMPT);
    
    // 3. Render to Branded HTML with Dynamic Title Extraction
    let finalTitle = "Executive Analysis Report";
    let processedMarkdown = reportMarkdown;
    
    const titleMatch = reportMarkdown.match(/^# TITLE:\s*(.*)/m);
    if (titleMatch) {
        finalTitle = titleMatch[1].trim();
        // Remove the title line from the markdown body to avoid double content
        processedMarkdown = reportMarkdown.replace(/^# TITLE:.*\n?/m, '').trim();
    }

    const contentHtml = markdownIt.render(processedMarkdown);
    const finalHtml = GET_BRANDED_HTML(contentHtml, finalTitle);

    res.json({ 
      success: true, 
      html: finalHtml,
      metadata: {
        conversation_id,
        finalTitle,
        timestamp: new Date().toISOString(),
        document_count: docs.length
      }
    });

  } catch (err) {
    console.error('❌ [REPORT] Failed to generate reporting:', err);
    res.status(500).json({ 
      error: 'Reporting synthesis failed', 
      details: err.message 
    });
  }
});

// ─── CHAT ENDPOINT ──────────────────────────
app.post('/api/chat', upload.array('files', 10), async (req, res) => {
  try {
    const { message, conversation_id, uploadMode } = req.body;
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

    // Process files for AI context — read IMMEDIATELY while file is in memory/disk
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

      // Current turn: Use freshly extracted file contexts (file is available on disk right now)
      if (isLastMessage && fileContexts.length > 0) {
        for (const ctx of fileContexts) {
          if (ctx.text) combinedText += `\n\n--- DOCUMENT DATA ---\n${ctx.text}`;
          if (ctx.inlineData) inlineDataParts.push({ inlineData: ctx.inlineData });
        }
      } else if (msg.attachments && msg.attachments !== '[]') {
        // Historical turns: Attempt to restore from disk
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
                mimetype: 'application/octet-stream',
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
            const errorMsg = `⚠️ **Session Expired:** The underlying documents (${missingFiles.join(', ')}) were purged from server storage. Please start a new chat and re-upload the files to continue.`;
            await pool.query(
              'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
              [convId, 'model', errorMsg]
            );
            return res.json({ response: errorMsg, conversation_id: convId });
          }
        } catch (e) {
          console.error('Context recovery failed:', e);
        }
      }

      // Build final parts for this turn
      const parts = [{ text: combinedText }, ...inlineDataParts];
      contents.push({ role: msg.role, parts });
    }

    // Call Gemini
    console.log(`🧠 Master Extractor [${convId}]: "${(message || '').substring(0, 80)}" (${uploadedDocs.length} files)`);
    const systemPromptToUse = uploadMode === 'multiple' ? BATCH_SYSTEM_PROMPT : SYSTEM_PROMPT;
    let aiResponse = await callGemini(contents, systemPromptToUse);

    // --- JSON RESILIENCE LAYER (Shotgun Fencing & Truncation Repair) ---
    try {
      const startIdx = aiResponse.search(/[\[\{]/);
      if (startIdx !== -1 && !aiResponse.includes('```json')) {
        let potentialJson = aiResponse.substring(startIdx);
        // Basic check: if it doesn't end with a closing tag, or we suspect it's raw
        const endsWithClosing = potentialJson.trim().endsWith(']') || potentialJson.trim().endsWith('}');
        
        if (!endsWithClosing || !aiResponse.includes('```')) {
          const repaired = repairJson(potentialJson);
          try {
            let parsed = JSON.parse(repaired.replace(/:\s*NaN\b/g, ": null"));
            parsed = sanitizeAnalysisResponse(parsed, uploadedDocs);
            const cleanJson = JSON.stringify(parsed, null, 2);
            aiResponse = aiResponse.substring(0, startIdx).trim() + `\n\n\`\`\`json\n${cleanJson}\n\`\`\`\n`;
          } catch (innerE) {
            console.warn('⚠️ [Master Extractor] Repair failed to produce valid JSON:', innerE.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [Master Extractor] JSON Fencing/Repair Skip:', e.message);
    }

    // Save AI response
    await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'model', aiResponse]
    );

    res.json({ response: aiResponse, conversation_id: convId });
  } catch (err) {
    console.error('Master Extractor Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Batch Merge Engine ─────────────────────────────────────
const { execFile } = require('child_process');

app.post('/api/batch/analyze', upload.array('files', 50), async (req, res) => {
  try {
    const filesInfo = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let sheets = [];
      let columns = [];
      
      try {
        if (ext === '.xlsx' || ext === '.xls') {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(file.path);
          workbook.eachSheet((worksheet) => {
            sheets.push(worksheet.name);
            if (columns.length === 0) {
              const row = worksheet.getRow(1);
              if (row && row.values) {
                 row.eachCell((cell) => columns.push(cell.value ? cell.value.toString() : ''));
              }
            }
          });
        } else if (ext === '.csv') {
          sheets.push('Sheet1');
          const workbook = new ExcelJS.Workbook();
          await workbook.csv.readFile(file.path);
          const worksheet = workbook.worksheets[0];
          if (worksheet) {
            const row = worksheet.getRow(1);
            if (row && row.values) {
              row.eachCell((cell) => columns.push(cell.value ? cell.value.toString() : ''));
            }
          }
        }
      } catch (err) {
        console.error(`Failed to analyze ${file.originalname}:`, err);
      }
      
      filesInfo.push({
        name: file.originalname,
        path: file.path, 
        sheets: sheets,
        columns: [...new Set(columns)].filter(Boolean)
      });
    }
    res.json({ files: filesInfo });
  } catch (err) {
    console.error('Batch Analyze Error:', err);
    res.status(500).json({ error: 'Failed to analyze batch files' });
  }
});

app.post('/api/batch/execute', async (req, res) => {
  try {
    const { files, sheet_name, columns, mode, ai_instructions, output_format } = req.body;
    const outputFilename = `docjockey_merged_${Date.now()}`;
    const configPath = path.join(UPLOAD_DIR, `${outputFilename}_config.json`);
    
    // Map files to their local paths
    const filePaths = files.map(f => f.path);
    
    const config = {
      files: filePaths,
      sheet_name: sheet_name,
      columns: columns,
      output_format: output_format || 'xlsx',
      output_filename: outputFilename,
      mapping: {} 
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    const pyScript = path.join(__dirname, 'scripts', 'batch_processor.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    execFile(pythonCmd, [pyScript, configPath], { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      try { fs.unlinkSync(configPath); } catch (e) {}
      
      if (error) {
        console.error('Batch Execute Python Error:', stderr || error.message);
        return res.status(500).json({ error: 'Merge execution failed', details: stderr || error.message });
      }
      
      const successMatch = stdout.match(/SUCCESS_PATH:\s*(.+)/);
      if (successMatch) {
        const finalPath = successMatch[1].trim();
        const downloadUrl = `/api/download-result?file=${encodeURIComponent(finalPath.replace(/\\/g, '/'))}`;
        res.json({ downloadUrl });
      } else {
        res.status(500).json({ error: 'Could not determine output path', details: stdout });
      }
    });
    
  } catch (err) {
    console.error('Batch Execute Error:', err);
    res.status(500).json({ error: 'Failed to execute batch merge' });
  }
});

app.get('/api/download-result', (req, res) => {
  const filePath = req.query.file;
  if (!filePath) return res.status(400).send('No file specified');
  const fullPath = path.resolve(__dirname, '..', filePath);
  res.download(fullPath);
});

// ─── PDF Tools & Conversion Suite ───────────────────────────
app.post('/api/tools/:toolId', upload.any(), async (req, res) => {
  try {
    const toolId = req.params.toolId;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).send('No files uploaded');
    }

    const firstFile = files[0];
    const fileBuffer = fs.readFileSync(firstFile.path);

    if (toolId === 'pdf-to-word') {
      const fileContext = await getFileContext({
        path: firstFile.path,
        mimetype: firstFile.mimetype,
        originalname: firstFile.originalname
      });
      
      if (!fileContext) {
        return res.status(400).json({ error: 'Unsupported file type for conversion.' });
      }

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [fileContext, "Extract all text from this document exactly as it appears. Do not use markdown tags like ```."],
      });
      const rawAi = typeof result.text === 'function' ? result.text() : result.text;
      const extractedText = rawAi || 'No text could be extracted.';

      const doc = new Document({
        sections: [{ children: extractedText.split('\n').map(line => new Paragraph({ text: line })) }]
      });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Word_${Date.now()}.docx"`);
      return res.send(buffer);
    } 
    
    if (toolId === 'pdf-to-excel') {
      const fileContext = await getFileContext({
        path: firstFile.path,
        mimetype: firstFile.mimetype,
        originalname: firstFile.originalname
      });
      
      if (!fileContext) {
        return res.status(400).json({ error: 'Unsupported file type for conversion.' });
      }

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [fileContext, "Extract the data from this document and format it strictly as a CSV without any markdown block tags like ```csv. Include headers if applicable."],
      });
      const rawAi = typeof result.text === 'function' ? result.text() : result.text;
      const safeText = rawAi || 'No data could be extracted.';
      const extractedLines = safeText.replace(/```csv/gi, '').replace(/```/g, '').split('\n').filter(l => l.trim().length > 0);
      
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Extracted Data');
      extractedLines.forEach((line) => {
        sheet.addRow(line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))); 
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Excel_${Date.now()}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    
    if (toolId === 'word-to-pdf') {
      if (firstFile.originalname.toLowerCase().endsWith('.doc')) {
        return res.status(400).json({ error: 'Legacy .doc format is not supported by the parser. Please save your file as .docx and try again.' });
      }

      let result;
      try {
        result = await mammoth.extractRawText({ path: firstFile.path });
      } catch (e) {
        return res.status(400).json({ error: 'Failed to read Word document. Ensure it is a valid, uncorrupted .docx file.' });
      }

      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      const text = (result.value || "No text extracted").replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\s]/g, '?');
      
      // Proper Text Wrapping (Prevent Data Loss on long paragraphs)
      const paragraphs = text.split('\n');
      const lines = [];
      const MAX_LEN = 95;
      for (const p of paragraphs) {
        if (p.trim().length === 0) {
          lines.push('');
          continue;
        }
        let currentLine = '';
        for (const word of p.split(' ')) {
          if (currentLine.length + word.length + 1 > MAX_LEN) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          }
        }
        if (currentLine) lines.push(currentLine);
      }

      let y = page.getHeight() - 50;
      for (const line of lines) {
         if (y < 50) { page = pdfDoc.addPage(); y = page.getHeight() - 50; }
         page.drawText(line, { x: 50, y, size: 10 });
         y -= 15;
      }
      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Converted_${Date.now()}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    }
    
    if (toolId === 'excel-to-pdf') {
      const workbook = new ExcelJS.Workbook();
      const isCsv = firstFile.mimetype === 'text/csv' || firstFile.originalname.toLowerCase().endsWith('.csv');
      if (isCsv) {
        await workbook.csv.readFile(firstFile.path);
      } else {
        await workbook.xlsx.readFile(firstFile.path);
      }
      
      const pdfDoc = await PDFDocument.create();
      const targetSheets = req.body.sheets ? req.body.sheets.split(',').map(s => s.trim().toLowerCase()) : [];
      
      workbook.eachSheet((worksheet) => {
        if (targetSheets.length > 0 && !targetSheets.includes(worksheet.name.toLowerCase())) return;
        
        let page = pdfDoc.addPage();
        let y = page.getHeight() - 50;
        worksheet.eachRow((row) => {
          if (y < 50) { page = pdfDoc.addPage(); y = page.getHeight() - 50; }
          let rowValues = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
             let val = cell.text || (cell.value && cell.value.result !== undefined ? cell.value.result : cell.value) || '';
             if (val instanceof Date) val = val.toISOString().split('T')[0];
             else if (typeof val === 'object') val = JSON.stringify(val);
             
             val = String(val).replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\s]/g, ' ');
             rowValues.push(val);
          });
          page.drawText(rowValues.join(' | ').substring(0, 110), { x: 50, y, size: 9 });
          y -= 15;
        });
      });

      if (pdfDoc.getPageCount() === 0) {
         let page = pdfDoc.addPage();
         page.drawText("No data found or target sheet did not match.", { x: 50, y: page.getHeight() - 50, size: 12 });
      }
      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Converted_${Date.now()}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    }
    
    if (toolId === 'merge') {
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const fileBytes = fs.readFileSync(file.path);
        
        try {
          if (file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.originalname)) {
            let image;
            if (file.mimetype === 'image/png' || file.originalname.toLowerCase().endsWith('.png')) {
              image = await mergedPdf.embedPng(fileBytes);
            } else {
              image = await mergedPdf.embedJpg(fileBytes);
            }
            const page = mergedPdf.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          } else {
            const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
          }
        } catch (e) {
          console.error(`Skipping unmergeable file ${file.originalname}:`, e);
        }
      }
      
      if (mergedPdf.getPageCount() === 0) mergedPdf.addPage(); // Prevent empty document crash
      const pdfBytes = await mergedPdf.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Merged_${Date.now()}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    }

    if (toolId === 'split') {
      const sequence = req.body.sequence || req.body.ranges; // Frontend uses 'ranges' for split
      const pdfBytes = fs.readFileSync(firstFile.path);
      let pdf;
      try {
        pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (e) {
        return res.status(400).json({ error: 'Failed to read PDF. Ensure it is a valid, uncorrupted document.' });
      }
      const totalPages = pdf.getPageCount();
      
      const outPdf = await PDFDocument.create();
      let pagesToExtract = [];
      
      if (sequence) {
        const parts = sequence.split(',').map(s => s.trim());
        for (const part of parts) {
          if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
               if (i >= 1 && i <= totalPages) pagesToExtract.push(i - 1);
            }
          } else {
            const i = Number(part);
            if (i >= 1 && i <= totalPages) pagesToExtract.push(i - 1);
          }
        }
      } 
      
      if (pagesToExtract.length === 0) {
        pagesToExtract = [0]; // Fallback to first page if invalid sequence
      }
      
      const copiedPages = await outPdf.copyPages(pdf, pagesToExtract);
      copiedPages.forEach((page) => outPdf.addPage(page));
      
      const outBytes = await outPdf.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Split_${Date.now()}.pdf"`);
      return res.send(Buffer.from(outBytes));
    }
    
    if (toolId === 'compress' || toolId === 'repair') {
      if (firstFile.mimetype.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(firstFile.originalname)) {
        return res.status(400).json({ error: 'Compress/Repair tools only support PDF documents, not images.' });
      }
      const pdfBytes = fs.readFileSync(firstFile.path);
      let pdf;
      try {
        pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (e) {
        return res.status(400).json({ error: 'File is severely corrupted and cannot be repaired automatically.' });
      }
      const outBytes = await pdf.save({ useObjectStreams: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_${toolId === 'compress' ? 'Compressed' : 'Repaired'}_${Date.now()}.pdf"`);
      return res.send(Buffer.from(outBytes));
    }
    
    if (toolId === 'rotate') {
      if (firstFile.mimetype.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(firstFile.originalname)) {
        return res.status(400).json({ error: 'Rotate Pages tool only supports PDF documents.' });
      }
      const degrees = parseInt(req.body.degrees) || 90;
      const pdfBytes = fs.readFileSync(firstFile.path);
      let pdf;
      try {
        pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (e) {
        return res.status(400).json({ error: 'Failed to read PDF. Ensure it is a valid, uncorrupted document.' });
      }
      const pages = pdf.getPages();
      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees + currentRotation);
      });
      const outBytes = await pdf.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Rotated_${Date.now()}.pdf"`);
      return res.send(Buffer.from(outBytes));
    }

    if (toolId === 'reorder') {
      if (firstFile.mimetype.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(firstFile.originalname)) {
        return res.status(400).json({ error: 'Organize Pages tool only supports PDF documents.' });
      }
      const sequence = req.body.sequence; // e.g., "3,1,2"
      const pdfBytes = fs.readFileSync(firstFile.path);
      let pdf;
      try {
        pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (e) {
        return res.status(400).json({ error: 'Failed to read PDF. Ensure it is a valid, uncorrupted document.' });
      }
      const totalPages = pdf.getPageCount();
      
      const outPdf = await PDFDocument.create();
      let pageIndices = [];
      if (sequence) {
        pageIndices = sequence.split(',').map(s => Number(s.trim()) - 1).filter(i => i >= 0 && i < totalPages);
      }
      
      if (pageIndices.length === 0 && sequence) {
         return res.status(400).json({ error: 'None of the requested pages exist in this document.' });
      }
      
      const copiedPages = await outPdf.copyPages(pdf, pageIndices.length > 0 ? pageIndices : pdf.getPageIndices());
      copiedPages.forEach((page) => outPdf.addPage(page));
      
      const outBytes = await outPdf.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_Reordered_${Date.now()}.pdf"`);
      return res.send(Buffer.from(outBytes));
    }
    
    if (toolId === 'edit') {
      const instructions = req.body.instructions || req.body.ai_instructions || 'Redraft this document cleanly.';
      const fileContext = await getFileContext({
        path: firstFile.path,
        mimetype: firstFile.mimetype,
        originalname: firstFile.originalname
      });
      
      if (!fileContext) {
        return res.status(400).json({ error: 'Unsupported file type for A.I. Smart Redraft.' });
      }

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [fileContext, `Read this document and rewrite/redraft it according to these instructions: "${instructions}". Output the clean, final text without markdown tags.`],
      });
      const rawAi = typeof result.text === 'function' ? result.text() : result.text;
      const aiText = rawAi || 'No redrafting could be completed.';
      
      // Output as a clean Word Document since "editing/redrafting" is best served as editable text
      const doc = new Document({
        sections: [{ children: aiText.split('\n').map(line => new Paragraph({ text: line })) }]
      });
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="DocJockey_SmartRedraft_${Date.now()}.docx"`);
      return res.send(buffer);
    }

    return res.status(400).json({ error: `Tool ${toolId} not fully implemented yet.` });
  } catch (err) {
    console.error(`Tool Error [${req.params.toolId}]:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Export Endpoints (Excel & Word) ───────────────────────
app.post('/api/export/excel', async (req, res) => {
  try {
    const { data, filename } = req.body;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DocJockey Export');
    
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      sheet.columns = headers.map(h => ({ header: h.toUpperCase(), key: h, width: 20 }));
      
      // Styling Header
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'FF2D3748' } };
      
      data.forEach(row => sheet.addRow(row));
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename || 'export'}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel Export Error:', err);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

app.post('/api/export/word', async (req, res) => {
  try {
    const { data, filename } = req.body;
    let docRows = [];
    
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Header Row
      const headerRow = new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ text: h.toUpperCase(), style: 'Strong' })],
          shading: { fill: "2D3748" },
        }))
      });
      docRows.push(headerRow);
      
      // Data Rows
      data.forEach(row => {
        const dataRow = new TableRow({
          children: headers.map(h => new TableCell({
            children: [new Paragraph({ text: String(row[h] || '—') })]
          }))
        });
        docRows.push(dataRow);
      });
    }

    const table = new Table({
      rows: docRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: "DocJockey Intelligence Export", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
          new Paragraph({ text: "" }), // Spacing
          table
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=${filename || 'export'}.docx`);
    res.send(buffer);
  } catch (err) {
    console.error('Word Export Error:', err);
    res.status(500).json({ error: 'Failed to generate Word file' });
  }
});

// ─── Production Static Serving ─────────────────────────────
const DIST_PATH = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST_PATH)) {
  console.log(`✅ [PROD] Serving Static Frontend from: ${DIST_PATH}`);
  app.use(express.static(DIST_PATH));
  
  // Handle SPA routing - Bypasses path-to-regexp parser using manual Regex to prevent crash
  app.get(/^(?!\/api).*/, (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
  });
} else {
  console.warn(`⚠️ [PROD] Frontend 'dist' folder NOT found at: ${DIST_PATH}. Static serving disabled.`);
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 DocJockey Backend running on port ${PORT}`);
  initDB();
});










