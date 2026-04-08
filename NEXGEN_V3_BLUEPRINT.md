# NexGen AI v3.0 — Final Blueprint
## "I told it what I wanted and it built that for me."

---

## 🎯 Identity
NexGen is a **Universal Agentic Document Intelligence Platform.**
It is NOT a PDF editor. It is NOT an invoice reader.
It is a "Persistent Knowledge Workspace" where users upload any document,
tell the AI what they need, and get structured, exportable results instantly.

**Comparable to:** Atlas + Reducto + ChatPDF (combined)
**Differentiator:** Credit-based pricing (no expiring subscriptions) + Self-hostable

---

## 🏛️ Architecture

### Frontend (React + Vite + Tailwind)
- **Landing Page:** Zero-friction "Try Before Signup" — user can drop a PDF 
  and chat with it immediately. No account required for first 3 uses.
- **Dashboard:** Workspace-based. Each workspace is a persistent library.
- **Chat Interface:** Conversational (like ChatGPT). User asks questions,
  AI responds with structured data, tables, summaries, or insights.
- **Results View:** Dynamic — adapts to document type:
  - Tables for structured data (invoices, spreadsheets)
  - Markdown for narratives (white papers, contracts, technical docs)
  - Mixed for complex documents

### Backend (Node.js + Express)
- **AI Engine:** Gemini 2.5 Pro (1M token context window)
  - Phase 1: Full-context stuffing (send entire PDF text per turn)
  - Phase 2: RAG pipeline (chunk → embed → retrieve) for scale
- **Database:** SQLite with FTS5 (Full-Text Search) for instant keyword search
- **File Storage:** Local uploads directory (cloud: S3/GCS later)
- **Auth:** Simple JWT-based. Optional — app works without login for first 3 uses.

### Self-Hosted Option (Phase 2)
- **Docker container** with Ollama (Llama 3 / Mistral)
- Zero cloud dependency for enterprise clients
- All processing happens behind the client's firewall

---

## 💰 Pricing Model (Credit-Based, No Expiry)

| Plan | Price | Credits | Per-PDF Cost | Features |
|------|-------|---------|--------------|----------|
| **Free Trial** | $0 | 3 credits | Free | Basic extraction, no login |
| **Starter** | $6 (₹499) | 100 credits | $0.06 | Chat, Export, History |
| **Pro** | $24 (₹1,999) | 500 credits | $0.05 | Workspaces, Bulk Export, Priority |
| **Enterprise** | Custom | Unlimited | Custom | Self-hosted, API access, SLA |

**Key Rule:** Credits NEVER expire. Users buy once, use forever.
This is our #1 differentiator against Humata ($9.99/mo) and Atlas ($12/mo).

---

## 🚀 Core Features

### Phase 1: Universal Parser + Chat (MVP)
1. **Zero-Friction Upload:** Drop any PDF — invoice, contract, white paper, 
   cheat sheet, lab report — no pre-configuration needed.
2. **Agentic Command Chat:** User types what they want in natural language.
   AI responds with structured output.
   - "Extract all dates and parties from this contract"
   - "Summarize this 50-page white paper in 5 bullet points"
   - "Create a comparison table of specs from these 3 datasheets"
3. **Dynamic Results UI:** Table view for structured data. Reading view for
   narratives. The UI adapts to the AI's output automatically.
4. **Export:** CSV, JSON, or Tally XML — user picks the format.

### Phase 2: Knowledge Workspace
5. **Persistent Workspaces:** Group documents into projects/folders.
   Each workspace retains context between sessions.
6. **Cross-Document Search:** "Find all mentions of 'liability' across 
   my 50 contracts" — uses SQLite FTS5 for instant keyword search.
7. **Chat Memory:** Conversation history is saved per workspace.
   User can pick up where they left off.

### Phase 3: Human Correction + Integrations
8. **Click-to-Fix:** Side-by-side view — AI output on the left,
   original PDF on the right. Click any cell to correct it.
9. **Clickable Citations:** Every extracted value links back to the
   exact page/line in the source PDF.
10. **Google Drive / Dropbox Sync:** Auto-import documents from cloud storage.

### Phase 4: Enterprise & Self-Hosted
11. **Docker Deployment:** One-command setup for on-premise hosting.
12. **API Endpoint:** `POST /api/extract` for developers to integrate.
13. **Team Workspaces:** Shared libraries with role-based access.

---

## 🎨 UX Strategy

### Landing Page
- **Hero Section:** "Upload any document. Tell us what you need. Done."
- **Live Demo:** An actual working dropzone on the landing page itself.
  User drops a PDF, types a question, sees real AI output. No signup.
- **Social Proof:** "X documents processed. Y hours saved."

### Onboarding Flow
1. User lands on page → sees the dropzone immediately
2. Drops a PDF → Chat opens → AI responds
3. After 3 free uses → soft prompt to create account
4. Account created → persistent workspace unlocked

### Retention Mechanics
- Persistent workspaces (data compounds over time)
- "New insights" notifications when new docs are added
- Team collaboration (shared workspaces)
- Integration hooks (Google Drive auto-sync)

---

## 🛠️ Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite + Tailwind CSS | Dashboard + Chat UI |
| Animations | Framer Motion | Micro-interactions |
| Backend | Node.js + Express | API + File handling |
| AI Engine | Gemini 2.5 Pro (API) | Document understanding |
| Database | SQLite + FTS5 | History + Full-text search |
| Auth | JWT (jsonwebtoken) | User sessions |
| Payments | Stripe / Razorpay | Credit purchases |
| Self-Hosted AI | Ollama + Llama 3 | Local inference |
| Deployment | Render.com / Docker | Cloud + Self-hosted |

---

## 📊 Build Timeline

| Phase | What | Sessions | Status |
|-------|------|----------|--------|
| **1** | Universal Parser + Dynamic Chat UI | 3-4 | 🔴 Next |
| **2** | Persistent Workspaces + Search | 2-3 | ⬜ Planned |
| **3** | Human Correction + Citations | 2-3 | ⬜ Planned |
| **4** | Dynamic Export Engine | 1-2 | ⬜ Planned |
| **5** | Credit System + Auth + Landing | 2-3 | ⬜ Planned |
| **6** | Docker Self-Hosted Package | 1-2 | ⬜ Planned |

**Estimated Total: 12-16 sessions for full MVP.**

---

## 📝 Research Sources
- Cross-Document Intelligence: Atlas, Denser (RAG + semantic search)
- Vision Parsing: Reducto, LlamaParse (VLMs for charts/tables)
- Human-in-the-Loop: UiPath, Google Document AI
- Privacy: Stirling-PDF (Docker), LocalPDF.io (WebAssembly)
- Pricing: Humata ($9.99/mo), Atlas ($12/mo), AIDetectPlus (credit-based)
- UX: ChatPDF, Smallpdf (try-before-signup), Unriddle (inline citations)

---
*Final Blueprint — NexGen AI v3.0 — 2026-04-08*
