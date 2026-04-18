# NexGen AI PDF SaaS Toolkit (Phase 2)

## Overview
NexGen is the professional, monetizable evolution of our original PDF Reader. It is an enterprise-grade SaaS toolkit designed to turn unstructured PDF documents into high-fidelity structured data. By leveraging native multimodal AI (Gemini 2.5 Flash / 2.0 Pro), NexGen eliminates the need for rigid OCR templates and bounding boxes.

## Monetization Roadmap
- **Tier 1: Professional Individual** (Per-document pricing, basic extraction).
- **Tier 2: Business Enterprise** (Batch processing, advanced table itemization, deep Excel links).
- **Tier 3: API-As-A-Service** (Direct hook for accounts/procurement departments).

## Core SaaS Features
1. **Intelligent Line-Item Splitting (V2):**
   Robust horizontal and vertical table parsing. Every line item is treated as a unique database record while retaining parent invoice metadata (Invoice #, Date, GSTIN).
2. **Context-Aware Mapping:**
   Resilient to layout changes. Whether it's a hand-scanned receipt or a typed enterprise invoice, the AI understands field locations contextually.
3. **Advanced Export Engine:**
   Clickable Excel links, JSON exports, and CSV formatting tailored for Accounting software (SAP, Tally, Zoho).
4. **Resilient High-Speed Throttling:**
   Automatic 429 error handling and cooldown loops to maximize throughput on free and paid Gemini API tiers.

## Proposed Technical Stack (SaaS Ready)
- **Frontend:** **React (Vite)** + **Tailwind CSS**. Designed for a premium, dashboard-style user experience with smooth micro-animations.
- **Backend:** Node.js + Express (Modular architecture).
- **AI Engine:** `@google/genai` (native PDF mode—zero dependencies on local OCR libraries).
- **Data Persistence:** SQLite/PostgreSQL (for user history) + Stripe (for payment integration).

## New Project Setup
- **Root Directory:** `C:\work folder\projects\pdf_saas_app`
- **Documentation:** `gemini.md` (Blueprint)
- **Status:** Architecture definition complete. Ready for frontend scaffolding.

## Future Phase Roadmap
1.  **Executive Reporting Engine:**
    Implement Quarto-style Markdown/HTML reporting. Generate professional-grade summaries with embedded Python statistical visualizations and mathematical verification summaries.
2.  **Advanced persistence:**
    Transition from local storage to a robust PostgreSQL/Supabase layer for multi-user session persistence.

---
*Derived and upgraded from the stable Proof-of-Concept at `c:\work folder\projects\pdf_reader`. NexGen focuses on performance, UI premiumness, and market-ready features.*
