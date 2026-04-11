// ─── Rescue Logger ──────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 FATAL CRASH (Uncaught Exception):', err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 FATAL CRASH (Unhandled Rejection):', reason);
  process.exit(1);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, VerticalAlign } = require('docx');
const pdflib = require('pdf-lib');
const { PDFDocument, rgb, degrees, StandardFonts } = pdflib;
const archiver = require('archiver');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// ─── Config ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY' });
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in environment variables.');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── Privacy Middleware ──────────────────────────────────
app.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || 'anonymous';
  next();
});

// ─── SQLite Setup ────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'onestopdoc.db'));

db.serialize(() => {
  // Conversations table
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table (chat history)
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  )`);

  // Documents table (uploaded files)
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    user_id TEXT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    extracted_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── Migration: Add user_id column if missing ────────────
  db.all("PRAGMA table_info(conversations)", (err, rows) => {
    if (rows && !rows.find(r => r.name === 'user_id')) {
      db.run("ALTER TABLE conversations ADD COLUMN user_id TEXT");
    }
  });
  db.all("PRAGMA table_info(documents)", (err, rows) => {
    if (rows && !rows.find(r => r.name === 'user_id')) {
      db.run("ALTER TABLE documents ADD COLUMN user_id TEXT");
    }
  });
});

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
      'application/msword'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, Word, Excel, and CSV files are allowed'), false);
  },
});

// ─── Gemini Engine ───────────────────────────────────────
const SYSTEM_PROMPT = `You are NexGen AI — a universal document intelligence assistant.

You can analyze ANY type of PDF document: invoices, contracts, white papers, 
technical manuals, lab reports, resumes, cheat sheets, academic papers, and more.

RULES:
1. Respond conversationally. Be helpful, precise, and concise.
2. When analyzing a document, adapt your response to the document type:
   - For TABULAR data (invoices, spreadsheets): Return a JSON block with structured data.
   - For NARRATIVE documents (papers, manuals): Return a clear summary with key points.
   - For MIXED documents: Return both structured data AND a summary.
3. When returning structured/tabular data, wrap it in a \`\`\`json code block.
   - CRITICAL SYSTEM RULE: YOU MUST NEVER USE MARKDOWN TABLES (e.g. | Column |). 
   - IF THE USER ASKS FOR A "TABLE" OR "TABULAR FORMAT", YOU MUST STILL RETURN A \`\`\`json ARRAY INSTEAD. The frontend will automatically convert the JSON block into an interactive Datatable. Markdown tables will break the web application.
4. When the user asks you to "extract" or "build a table", always return data as a JSON array of objects.
   - CRITICAL RULE: Ensure the JSON objects for tabular data are completely FLAT. Do NOT use nested objects or arrays inside the rows.
   - For example, instead of returning \`"tax": {"cgst": 9, "sgst": 9}\`, use separate flat columns: \`"cgst_tax": 9, "sgst_tax": 9\`.
   - STANDARDIZE DATES: Whenever you extract a date, convert it strictly to the "YYYY-MM-DD" format (e.g., "2024-11-02").
5. If the user asks a follow-up question about a previously uploaded document, use your memory of the conversation.
6. Always be ready to export data. If asked, format it as CSV-ready or JSON.
7. Never refuse to analyze a document. Adapt to whatever the user needs.`;

async function getFileContext(file) {
  if (file.mimetype === 'application/pdf') {
    return {
      inlineData: {
        data: fs.readFileSync(file.path).toString('base64'),
        mimeType: 'application/pdf',
      },
    };
  } else if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.mimetype.includes('csv')) {
    const workbook = new ExcelJS.Workbook();
    if (file.mimetype === 'text/csv') await workbook.csv.readFile(file.path);
    else await workbook.xlsx.readFile(file.path);
    
    let excelText = `EXCEL CONTENT (File: ${file.originalname}):\n`;
    workbook.eachSheet(sheet => {
      excelText += `Sheet: ${sheet.name}\n`;
      sheet.eachRow(row => {
        excelText += `| ${row.values.filter(v => v !== undefined).join(' | ')} |\n`;
      });
    });
    return { text: excelText };
  } else if (file.mimetype.includes('word') || file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc')) {
    return {
      inlineData: {
        data: fs.readFileSync(file.path).toString('base64'),
        mimeType: file.mimetype,
      },
    };
  }
  return null;
}

async function callGemini(contents, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ codeExecution: {} }],
        }
      });
      return response.text;
    } catch (err) {
      if (err?.status === 429 && attempt < maxRetries) {
        const cooldown = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`⏱ Rate limited. Retry ${attempt}/${maxRetries} in ${Math.round(cooldown)}ms`);
        await new Promise((r) => setTimeout(r, cooldown));
      } else {
        throw err;
      }
    }
  }
}



// ─── Routes ──────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NexGen AI v3.0', version: '3.0.0' });
});

// ─── GET Conversations ───────────────────────────────────
app.get('/api/conversations', (req, res) => {
  db.all('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100', [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get messages for a conversation
app.get('/api/conversations/:id/messages', (req, res) => {
  db.all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Delete a conversation
app.delete('/api/conversations/:id', (req, res) => {
  // First verify ownership
  db.get('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [req.params.id, req.userId], (err, row) => {
    if (err || !row) return res.status(403).json({ error: 'Unauthorized to delete this chat.' });
    
    db.run('DELETE FROM messages WHERE conversation_id = ?', [req.params.id]);
    db.run('DELETE FROM documents WHERE conversation_id = ?', [req.params.id]);
    db.run('DELETE FROM conversations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });
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
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)', [convId, req.userId, title], (err) => {
          if (err) reject(err); else resolve();
        });
      });
    }

    // Process files for AI context
    const fileContexts = [];
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const context = await getFileContext(file);
        if (context) fileContexts.push(context);
        
        // Save to DB
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO documents (conversation_id, user_id, filename, original_name, file_size) VALUES (?, ?, ?, ?, ?)',
            [convId, req.userId, file.filename, file.originalname, file.size],
            (err) => { if (err) reject(err); else resolve(); }
          );
        });
        uploadedDocs.push({ filename: file.filename, original_name: file.originalname });
      }
    }

    // Save user message
    const attachmentNames = uploadedDocs.map(d => d.original_name);
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (conversation_id, role, content, attachments) VALUES (?, ?, ?, ?)',
        [convId, 'user', message || '', JSON.stringify(attachmentNames)],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    // Load history
    const dbMessages = await new Promise((resolve, reject) => {
      db.all(
        'SELECT role, content, attachments FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [convId],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    const contents = [];
    for (const msg of dbMessages) {
      const parts = [{ text: msg.content }];
      // If this is the current message, add the new file contexts
      if (msg === dbMessages[dbMessages.length - 1]) {
        fileContexts.forEach(ctx => {
          if (ctx.text) parts.push({ text: ctx.text });
          if (ctx.inlineData) parts.push({ inlineData: ctx.inlineData });
        });
      }
      contents.push({ role: msg.role, parts });
    }

    // Call Gemini
    console.log(`🧠 NexGen Chat [${convId}]: "${(message || '').substring(0, 80)}..." (${uploadedDocs.length} files)`);
    const aiResponse = await callGemini(contents);

    // Save AI response
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
        [convId, 'model', aiResponse],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    // Update conversation timestamp & title
    db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [convId]);

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

// ─── PDF TOOL: A.I. Editor ──────────────────────────────
app.post('/api/tools/edit', upload.single('file'), async (req, res) => {
  try {
    const { instructions } = req.body;
    if (!req.file || !instructions) return res.status(400).json({ error: 'Missing file or instructions.' });

    const pdfData = {
      inlineData: {
        data: fs.readFileSync(req.file.path).toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    const prompt = `You are a PDF Content Editor. 
    TASK: ${instructions}
    
    Analyze the document and provide the FULL TEXT of the page, but with the requested changes applied perfectly. 
    Maintain the structure exactly.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }, pdfData] }]
    });
    const editedText = response.text;

    const pdfDoc = await PDFDocument.create();
    const { width, height } = { width: 600, height: 800 };
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([width, height]);
    let y = height - 50;

    // --- Header ---
    page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: rgb(0.04, 0.04, 0.04) });
    page.drawText('NexGen A.I. SMART REDRAFT', { x: 50, y: height - 35, size: 14, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(`Redrafted on: ${new Date().toLocaleDateString()}`, { x: width - 200, y: height - 35, size: 8, font, color: rgb(0.8, 0.8, 0.8) });

    // --- Page Border ---
    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 80, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1 });

    y -= 40; // Move below header

    // --- Content with Line Wrapping ---
    const lines = editedText.split('\n');
    const margin = 50;
    const maxWidth = width - (margin * 2);

    for (const line of lines) {
      if (y < 80) { // New page if near bottom
        page = pdfDoc.addPage([width, height]);
        page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1 });
        y = height - 50;
      }

      // Simple word wrap
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = font.widthOfTextAtSize(testLine, 9);
        
        if (textWidth > maxWidth) {
          page.drawText(currentLine, { x: margin, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
          y -= 14;
          currentLine = word;
          if (y < 80) break; // Simplified page break check
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, { x: margin, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 18; // Extra padding between paragraphs
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Smart_Redraft_Export.pdf');
    res.send(Buffer.from(pdfBytes));
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (err) {
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
  
  // Handle Objects (Formulas, Shared Strings, RichText)
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined) return String(cell.value.result);
    if (cell.value.text !== undefined) return String(cell.value.text);
    if (Array.isArray(cell.value.richText)) return cell.value.richText.map(rt => rt.text).join('');
    if (cell.value.formula) return String(cell.value.result || '');
    return ''; // Do NOT stringify the object, it causes [object Object]
  }
  
  return String(cell.value);
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }, inputData] }]
    });

    const data = extractCleanJson(response.text);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NexGen_Structural_Export');
    
    if (data.length > 0) {
      // Check if data is array of objects (Horizontal Table)
      if (!Array.isArray(data[0]) && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        data.forEach(item => {
          worksheet.addRow(headers.map(h => {
            let val = item[h];
            return typeof val === 'string' ? val.replace(/\*\*\*/g, '').replace(/\*\*/g, '') : val;
          }));
        });
        worksheet.getRow(1).font = { bold: true };
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
    await workbook.xlsx.readFile(req.file.path);
    
    const targetNames = sheets ? sheets.split(',').map(s => s.trim().toLowerCase()) : [];
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    for (const worksheet of workbook.worksheets) {
      if (targetNames.length > 0 && !targetNames.includes(worksheet.name.trim().toLowerCase())) continue;

      // ─── 1. Density-Based Column & Row Trimming ───
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

      const page = pdfDoc.addPage([1190, 842]); 
      const { width, height } = page.getSize();
      let y = height - 60;
      
      page.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: rgb(0.05, 0.05, 0.05) });
      page.drawText(`SHEET: ${worksheet.name.toUpperCase()}`, { x: 50, y: height - 25, size: 12, font: fontBold, color: rgb(1, 1, 1) });

      const margin = 40;
      const availableWidth = width - (margin * 2);
      
      // Auto-stretch active columns to fill width
      const colWidth = availableWidth / activeCols.length;
      const rowHeight = 22;

      // Draw Grid Header Background
      page.drawRectangle({ x: margin, y: y - rowHeight, width: availableWidth, height: rowHeight, color: rgb(0.95, 0.95, 0.95) });

      for (let r = 1; r <= maxRow; r++) {
        if (y < 60) break;
        const row = worksheet.getRow(r);
        let x = margin;

        for (const c of activeCols) {
          const cell = row.getCell(c);
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
                font: r === 1 ? fontBold : font,
                color: rgb(0.1, 0.1, 0.1)
              });
            } catch(e) {}
          }
          x += colWidth;
        }
        y -= rowHeight;
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const blocks = extractCleanJson(response.text);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([600, 842]);
    const { width, height } = page.getSize();
    let y = height - 50;
    const margin = 50;
    const availableWidth = width - (margin * 2);

    for (const block of blocks) {
      if (y < 80) {
        page = pdfDoc.addPage([600, 842]);
        y = height - 50;
      }

      const content = typeof block.content === 'string' 
        ? block.content.replace(/\*\*\*/g, '').replace(/\*\*/g, '') 
        : block.content;

      if (block.type === 'h1' || block.type === 'h2') {
        const size = block.type === 'h1' ? 18 : 14;
        page.drawText(String(content), { x: margin, y: y - size, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        y -= (size + 20);
      } 
      else if (block.type === 'table') {
        const rows = Array.isArray(content) ? content : [];
        if (rows.length === 0) continue;
        
        const colCount = rows[0].length;
        const colWidth = availableWidth / Math.max(colCount, 1);
        const rowHeight = 20;

        for (const [rowIndex, row] of rows.entries()) {
          if (y < 60) { page = pdfDoc.addPage([600, 842]); y = height - 50; }
          
          let x = margin;
          for (const cell of row) {
            const cellText = String(cell || '').replace(/\*\*\*/g, '').replace(/\*\*/g, '').substring(0, 40);
            
            // Draw Cell
            page.drawRectangle({
              x, y: y - rowHeight,
              width: colWidth, height: rowHeight,
              borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5
            });

            page.drawText(cellText, {
              x: x + 5, y: y - (rowHeight / 1.5),
              size: 8, font: rowIndex === 0 ? fontBold : font
            });
            x += colWidth;
          }
          y -= rowHeight;
        }
        y -= 10;
      } 
      else {
        // Paragraph with basic wrap
        const words = String(content).split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          if (font.widthOfTextAtSize(testLine, 10) > availableWidth) {
            page.drawText(line, { x: margin, y, size: 10, font });
            y -= 14;
            line = word;
            if (y < 50) { page = pdfDoc.addPage([600, 842]); y = height - 50; }
          } else {
            line = testLine;
          }
        }
        page.drawText(line, { x: margin, y, size: 10, font });
        y -= 24;
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
  const { format } = req.query;
  
  db.all(
    'SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [req.params.id],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const jsonBlocks = [];
      for (const row of rows) {
        if (row.role === 'model') {
          const matches = row.content.match(/```json\n([\s\S]*?)```/g);
          if (matches) {
            for (const match of matches) {
              try {
                const clean = match.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(clean);
                if (Array.isArray(parsed)) jsonBlocks.push(...parsed);
                else jsonBlocks.push(parsed);
              } catch (e) { }
            }
          }
        }
      }

      // ─── Export: Excel (.xlsx) ───
      if (format === 'xlsx' && jsonBlocks.length > 0) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('OneStopDoc Extraction');
        
        const headers = Object.keys(jsonBlocks[0]);
        sheet.columns = headers.map(h => ({ header: h.toUpperCase(), key: h }));
        
        // Style headers
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }; // Brand Primary
        
        sheet.addRows(jsonBlocks);
        
        // Auto-width adjustment
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
              new Paragraph({ text: "OneStopDoc Intelligence Report", heading: HeadingLevel.TITLE }),
              new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, spacing: { after: 400 } }),
              ...rows.map(msg => [
                new Paragraph({
                  children: [
                    new TextRun({ text: msg.role === 'user' ? "YOU: " : "AI: ", bold: true, color: msg.role === 'user' ? "8B5CF6" : "0EA5E9" }),
                    new TextRun({ text: msg.content.replace(/```json[\s\S]*?```/g, '[Structured Data Table Attached]') })
                  ],
                  spacing: { before: 200 }
                })
              ]).flat()
            ]
          }]
        });

        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=OneStopDoc_Report_${Date.now()}.docx`);
        return res.send(buffer);
      }

      // Default: Metadata JSON
      res.json({ messages: rows, structured_data: jsonBlocks });
    }
  );
});

// ─── Dashboard stats ─────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as count FROM conversations', (err, row) => {
    stats.total_conversations = row?.count || 0;
    db.get('SELECT COUNT(*) as count FROM documents', (err2, row2) => {
      stats.total_documents = row2?.count || 0;
      db.get('SELECT COUNT(*) as count FROM messages', (err3, row3) => {
        stats.total_messages = row3?.count || 0;
        res.json(stats);
      });
    });
  });
});

// ─── Serve React Frontend (Production) ───────────────────
const FRONTEND_DIR = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(FRONTEND_DIR)) {
  console.log(`📦 Serving static frontend from: ${FRONTEND_DIR}`);
  app.use(express.static(FRONTEND_DIR));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
}

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 OneStopDoc v3.0 running on http://localhost:${PORT}`);
  console.log(`🧠 Engine: Gemini 2.5 Pro | Mode: Universal Chat`);
  console.log(`📊 Database: onestopdoc.db`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
});
