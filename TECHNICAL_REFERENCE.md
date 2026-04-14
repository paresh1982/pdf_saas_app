# NexGen AI: Technical Architecture & Deployment Reference

This document serves as the "Source of Truth" for the NexGen AI PDF SaaS configuration, documenting the critical engineering hurdles overcome during the transition from Localhost to Production (Render + Supabase).

## 🏗️ Core Infrastructure
- **Frontend**: React (Vite) + Tailwind CSS.
- **Backend**: Node.js + Express (Modular).
- **Database**: Supabase PostgreSQL (Session Pooler - Port 5432).
- **AI Engine**: Google Gemini AI (Multimodal).
- **Deployment**: Render (Web Service).

---

## 🛠️ Critical Challenges & Production Solutions

### 1. Database Connectivity (Supabase + Render)
**Problem**: Connection timeouts and SSL handshake failures when connecting from Render to Supabase.
**Solution**:
- **Connection String**: Use the IPv4 Session Pooler (usually Port 5432) with `?sslmode=require`.
- **Credential Safety**: Always URL-encode the database password if it contains special characters.
- **SSL Bypass**: 
  ```javascript
  // In server.js
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  ```
- **Global Override**: Set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the very top of `server.js` to handle self-signed certificate chains in cloud environments.

### 2. The "Invisible File" Problem (Ephemeral Filesystem)
**Problem**: Render deletes the `uploads/` folder on every restart/redeploy. If a user uploads a file and the server cycles, the AI loses access to the physical file.
**Solution**:
- **Direct In-Memory Injection**: During the active request, file data is converted to text/base64 immediately and injected into the AI context *before* the request finishes.
- **Unified Prompting**: Merging document data directly into the user’s text prompt string (e.g., `[USER QUERY] \n\n --- DOCUMENT DATA --- \n [EXTRACTED TEXT]`). This ensures the AI "Attention" mechanism sees the data and the question as a single unit.

### 3. Production MIME-Type Mismatches
**Problem**: Linux servers (Render) often identify `.xlsx` or `.docx` files as generic `application/octet-stream`, causing extraction logic to be skipped.
**Solution**:
- **Extension-First Detection**: Implemented a fallback that checks the file extension (`.pdf`, `.xlsx`, `.csv`) if the MIME type is vague.
  ```javascript
  const isExcel = mimeType.includes('spreadsheet') || originalName.endsWith('.xlsx');
  ```

### 4. Gemini SDK Version Compatibility
**Problem**: SDK syntax varies between versions (`getGenerativeModel` vs `models.generateContent`), leading to "not a function" errors.
**Solution**:
- **Polymorphic AI Wrapper**: A custom `callGemini` function that detects the available SDK methods at runtime and tries multiple "paths" (Shotgun Extraction) to find the AI's text response within the payload.

---

## 🚀 Deployment Checklist

### Environment Variables (Render)
| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Supabase Connection |
| `GEMINI_API_KEY` | `AIza...` | Google AI Access |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | SSL Stability |
| `NODE_ENV` | `production` | Optimization |

### File Extraction Protocol
- **PDF**: Sent as `inlineData` (Base64).
- **Excel**: Extracted via `ExcelJS` into a structured row/cell text block.
- **Word**: Handled via Base64 or manual extraction fallback.

---

## 📈 Future Scalability Path
1. **Persistent Storage**: Migrate from local `uploads/` to **Supabase Storage (S3)** to ensure files survive for days across server restarts.
2. **Database Context**: Store `extracted_text` in the `documents` table to avoid re-parsing files for every chat turn.
3. **Batch Processing**: Implement a background worker (Queue) for processing folders of 100+ invoices simultaneously.

---
**Last Updated**: 2026-04-14
**Status**: Production Stable (Render Cloud Verified)
