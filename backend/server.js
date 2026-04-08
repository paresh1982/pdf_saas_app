require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

// ─── Config ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── SQLite Setup ────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'onestopdoc.db'));

db.serialize(() => {
  // Conversations table
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
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
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    extracted_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
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
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
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
4. When the user asks you to "extract" or "build a table", always return data as a JSON array of objects.
   - CRITICAL RULE: Ensure the JSON objects for tabular data are completely FLAT. Do NOT use nested objects or arrays inside the rows.
   - For example, instead of returning \`"tax": {"cgst": 9, "sgst": 9}\`, use separate flat columns: \`"cgst_tax": 9, "sgst_tax": 9\`.
   - STANDARDIZE DATES: Whenever you extract a date, convert it strictly to the "YYYY-MM-DD" format (e.g., "2024-11-02"), no matter how it appears in the PDF.
5. If the user asks a follow-up question about a previously uploaded document, use your memory of the conversation.
6. Always be ready to export data. If asked, format it as CSV-ready or JSON.
7. Never refuse to analyze a document. Adapt to whatever the user needs.`;

async function callGemini(contents, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents,
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

// ─── Helper: Build Gemini conversation from DB messages ──
function buildGeminiContents(messages, pdfData = null) {
  const contents = [];

  // System instruction as first user message
  contents.push({
    role: 'user',
    parts: [{ text: SYSTEM_PROMPT }],
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'Understood. I am NexGen AI, ready to analyze any document you provide. Drop a PDF and tell me what you need.' }],
  });

  // Add conversation history
  for (const msg of messages) {
    const parts = [];

    // If this message has PDF attachments, include ALL of them
    if (msg.role === 'user' && msg.pdfParts && msg.pdfParts.length > 0) {
      for (const pdf of msg.pdfParts) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: pdf.data,
          },
        });
      }
    }

    parts.push({ text: msg.content });
    contents.push({ role: msg.role, parts });
  }

  return contents;
}

// ─── Routes ──────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NexGen AI v3.0', version: '3.0.0' });
});

// Create a new conversation
app.post('/api/conversations', (req, res) => {
  const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const title = req.body.title || 'New Chat';
  db.run('INSERT INTO conversations (id, title) VALUES (?, ?)', [id, title], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, title, created_at: new Date().toISOString() });
  });
});

// Get all conversations
app.get('/api/conversations', (req, res) => {
  db.all('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50', (err, rows) => {
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
  db.run('DELETE FROM messages WHERE conversation_id = ?', [req.params.id]);
  db.run('DELETE FROM documents WHERE conversation_id = ?', [req.params.id]);
  db.run('DELETE FROM conversations WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
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
        db.run('INSERT INTO conversations (id, title) VALUES (?, ?)', [convId, title], (err) => {
          if (err) reject(err); else resolve();
        });
      });
    }

    // Save uploaded files
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO documents (conversation_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
            [convId, file.filename, file.originalname, file.size],
            (err) => { if (err) reject(err); else resolve(); }
          );
        });
        uploadedDocs.push({
          filename: file.filename,
          original_name: file.originalname,
          path: file.path,
        });
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

    // Load conversation history from DB
    const dbMessages = await new Promise((resolve, reject) => {
      db.all(
        'SELECT role, content, attachments FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [convId],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    // Build Gemini contents
    const geminiMessages = [];
    for (let i = 0; i < dbMessages.length; i++) {
      const msg = dbMessages[i];
      const entry = { role: msg.role, content: msg.content };

      // For the CURRENT message (last one), attach ALL PDFs
      if (i === dbMessages.length - 1 && uploadedDocs.length > 0) {
        entry.pdfParts = uploadedDocs.map(doc => ({
          data: fs.readFileSync(doc.path).toString('base64'),
          name: doc.original_name,
        }));
      }

      geminiMessages.push(entry);
    }

    const contents = buildGeminiContents(geminiMessages);

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
