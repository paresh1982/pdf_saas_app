import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquarePlus,
  Send,
  Paperclip,
  FileText,
  Trash2,
  Zap,
  Loader2,
  Download,
  Copy,
  Check,
  X,
  ChevronDown,
  Plus,
  Bot,
  User,
  Sparkles,
  FileSpreadsheet,
  FileType,
  Combine,
  Scissors,
  RotateCw,
  Minimize2,
  Eraser,
  Type,
  ArrowRightLeft,
  Layout,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Menu,
  Database,
  Shuffle,
  Code,
  ChevronUp,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const API = '/api';

// ─── Simple Multi-User Identity ───
const UID = (() => {
  let id = localStorage.getItem('onestop_uid');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('onestop_uid', id);
  }
  return id;
})();

function SectionTitle({ children, className = "" }) {
  return (
    <div className={`mb-8 ${className}`}>
      <h2 className="text-3xl font-black tracking-tight text-white mb-2 uppercase italic">{children}</h2>
      <div className="w-20 h-1 red-gradient rounded-full" />
    </div>
  );
}

function PageContainer({ title, children }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 md:p-16 max-w-4xl mx-auto w-full min-h-[calc(100vh-160px)]"
    >
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-6 text-foreground/70 text-sm leading-relaxed font-medium">
        {children}
      </div>
    </motion.div>
  );
}

function AboutView() {
  return (
    <PageContainer title="The DocJockey Mission">
      <p>DocJockey isn't just a reader; it's a high-performance document engine architected for the speed of modern enterprise. Born from the need to turn stagnant PDFs into active intelligence, DocJockey leverages the world's most advanced document processing models to bridge the gap between unstructured data and structured success.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-12">
        <div className="glass-panel p-6 border-white/10 group hover:border-primary/40 transition-all">
          <Zap className="text-primary mb-4 group-hover:scale-110 transition-transform" size={32} />
          <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">Agentic Edge</h3>
          <p className="text-xs text-foreground/50 leading-relaxed uppercase tracking-widest font-bold">Autonomous itemization and context-aware mapping that eliminates manual entry.</p>
        </div>
        <div className="glass-panel p-6 border-white/10 group hover:border-secondary/40 transition-all">
          <Sparkles className="text-secondary mb-4 group-hover:scale-110 transition-transform" size={32} />
          <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">Zero-Blank Policy</h3>
          <p className="text-xs text-foreground/50 leading-relaxed uppercase tracking-widest font-bold">Our persistence layer ensures every line item retains its parent metadata for perfect accounting.</p>
        </div>
      </div>

      <p>By shifting the burden of extraction from human operators to agentic logic, DocJockey Pro empowers procurement, accounting, and legal teams to move at the speed of thought. We are redefining the document lifecycle—one extraction at a time.</p>
    </PageContainer>
  );
}

function PrivacyView() {
  return (
    <PageContainer title="Data Sovereignty">
      <section>
        <h3 className="text-white font-black uppercase tracking-[0.2em] mb-4 text-xs">1. Data Minimization</h3>
        <p>DocJockey AI operates on a strictly "need-to-process" basis. Your documents are ephemeral: they are processed in high-security memory buffers and are never used to train global AI models without explicit, enterprise-level consent.</p>
      </section>
      <section>
        <h3 className="text-white font-black uppercase tracking-[0.2em] mb-4 text-xs">2. Encryption Protocol</h3>
        <p>All data in transit is shielded via TLS 1.3, and data at rest (within our Supabase persistence layer) is encrypted using AES-256 standards. Your document intelligence is your unique competitive advantage; we ensure it stays that way.</p>
      </section>
      <section>
        <h3 className="text-white font-black uppercase tracking-[0.2em] mb-4 text-xs">3. User Sovereignty</h3>
        <p>You retain full ownership of all uploaded inputs and generated outputs. Our "Trash" protocols ensure that once a conversation is deleted, all associated document metadata is purged from our active processing cycles.</p>
      </section>
    </PageContainer>
  );
}

function DisclaimerView() {
  return (
    <PageContainer title="AI Accuracy Notice">
      <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl mb-8">
        <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
          While DocJockey leverages state-of-the-art multimodal reasoning, AI-generated outputs should be treated as high-fidelity drafts that require professional oversight.
        </p>
      </div>
      <section className="space-y-4">
        <p>DocJockey AI is provided on an "as-is" and "as-available" basis. We utilize probabilistic models to interpret complex document layouts; therefore, 100% accuracy in extraction cannot be guaranteed across all legacy or low-resolution scan formats.</p>
        <p>Liability for financial decisions, accounting entries, or legal interpretations made based on AI outputs remains solely with the human operator. We recommend manual verification of all extracted line items before committing to enterprise databases or financial filings.</p>
      </section>
    </PageContainer>
  );
}

function ContactView() {
  return (
    <PageContainer title="Command Center">
      <p className="mb-12">Need mission-critical support or custom API integration? Our team of document intelligence architects is ready to assist your enterprise transition.</p>
      
      <div className="space-y-4">
        <div className="flex items-center gap-6 p-6 glass-panel border-white/10 hover:border-secondary/40 transition-all cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
            <Bot size={24} />
          </div>
          <div>
            <h4 className="text-white font-black uppercase tracking-tight">Enterprise Success</h4>
            <p className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">success@docjockey.com</p>
          </div>
        </div>
        <div className="flex items-center gap-6 p-6 glass-panel border-white/10 hover:border-primary/40 transition-all cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Settings size={24} />
          </div>
          <div>
            <h4 className="text-white font-black uppercase tracking-tight">Technical Support</h4>
            <p className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">support@docjockey.com</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function HowItWorksView({ setView }) {
  const steps = [
    {
      number: '01',
      title: 'AI Chat Engine',
      color: 'primary',
      desc: 'The main workspace. Upload any PDF, image, Word, or Excel file and type your command in the input box. The AI engine reads the document natively—no pre-processing needed. Ask it to extract, summarize, or analyze. Results appear as structured JSON, tables, or readable text.',
      tips: ['Attach multiple files in a single message', 'Ask it to extract all line items from an invoice', 'Request a summary of a legal document']
    },
    {
      number: '02',
      title: 'Single Document vs Batch Processor',
      color: 'secondary',
      desc: 'Use the toggle at the top of the upload zone to switch modes. Single Document processes one file at a time with focused extraction. Batch Processor stages multiple files for simultaneous analysis, ideal for processing a full month of invoices in one pass.',
      tips: ['Batch mode supports mixed file types', 'Each file in a batch gets its own AI analysis context', 'Results are consolidated in the chat thread']
    },
    {
      number: '03',
      title: 'Merge PDF',
      color: 'primary',
      desc: 'Combine multiple PDF files into a single unified document. Select files from the tool modal, arrange them in order, and the engine produces a merged PDF ready for download. Useful for combining monthly reports, multi-part contracts, or assembled portfolios.',
      tips: ['Supports unlimited files per merge', 'Preserves original page quality', 'Output filename is auto-generated with timestamp']
    },
    {
      number: '04',
      title: 'Split PDF',
      color: 'secondary',
      desc: 'Divide a PDF into smaller parts. Leave the page range blank to split every page into an individual file, or specify custom ranges (e.g. 1-3, 5, 8-10) to extract specific sections. Output is packaged as a ZIP archive for easy download.',
      tips: ['Leave range blank = one file per page', 'Custom ranges: 1-3, 5, 8-10', 'ZIP archive delivered on completion']
    },
    {
      number: '05',
      title: 'Compress PDF',
      color: 'primary',
      desc: 'Reduce the file size of a PDF without significant quality loss. Useful for email attachments, portal uploads with size limits, or archiving large scanned documents. The engine optimizes embedded images and streams automatically.',
      tips: ['Ideal for scanned invoices and reports', 'Preserves text layer and searchability', 'File size reduction varies by content type']
    },
    {
      number: '06',
      title: 'PDF ↔ Word / Excel Conversion',
      color: 'secondary',
      desc: 'Convert between formats seamlessly. PDF to Word extracts structured text and layout into an editable DOCX. PDF to Excel converts tabular data into spreadsheet rows. Excel to PDF renders your spreadsheet for print or archive. Word to PDF converts DOCX to a professional PDF.',
      tips: ['AI-assisted table detection for PDF→Excel', 'Preserves heading hierarchy in PDF→Word', 'Excel output includes proper column headers']
    },
    {
      number: '07',
      title: 'A.I. Smart Redraft',
      color: 'primary',
      desc: 'Upload any document and provide natural language instructions. The AI re-generates the document incorporating your changes — update an invoice date, rename a vendor, change terms, or restructure content — and delivers a clean, professionally formatted output.',
      tips: ['Instructions like: Change invoice date to 2024-12-01', 'Update vendor name to ABC Corp', 'Rewrite Section 3 in formal tone']
    },
    {
      number: '08',
      title: 'Rotate & Organize Pages',
      color: 'secondary',
      desc: 'Rotate pages to 90°, 180°, or 270° to correct scanned documents. Organize Pages lets you reorder pages by specifying a new sequence (e.g. 2, 1, 3) — perfect for rearranging chapters or correcting assembly errors in a compiled report.',
      tips: ['Rotate: 90°, 180°, or 270°', 'Reorder: specify new sequence like 2,1,3,5,4', 'Results are instant single-file downloads']
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 md:p-16 max-w-4xl mx-auto w-full min-h-[calc(100vh-160px)]"
    >
      <div className="mb-12">
        <button onClick={() => setView('dashboard')} className="text-[10px] font-black text-secondary/60 hover:text-secondary uppercase tracking-[0.3em] mb-6 flex items-center gap-2 transition-colors">
          ← Back to Dashboard
        </button>
        <h2 className="text-3xl font-black tracking-tight text-white mb-2 uppercase italic">How DocJockey Works</h2>
        <div className="w-20 h-1 red-gradient rounded-full mb-4" />
        <p className="text-foreground/50 text-sm font-medium">A complete guide to every feature, in the order you'll use them.</p>
      </div>

      <div className="space-y-8">
        {steps.map((step) => (
          <div key={step.number} className={`glass-panel p-6 border-white/10 hover:border-${step.color}/30 transition-all group`}>
            <div className="flex items-start gap-6">
              <div className={`shrink-0 w-12 h-12 rounded-2xl bg-${step.color}/10 flex items-center justify-center`}>
                <span className={`text-${step.color} text-xs font-black`}>{step.number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-black uppercase tracking-tight mb-3">{step.title}</h3>
                <p className="text-foreground/60 text-sm leading-relaxed mb-4">{step.desc}</p>
                <div className="space-y-1">
                  {step.tips.map((tip, i) => (
                    <p key={i} className={`text-[10px] font-black text-${step.color}/60 uppercase tracking-widest`}>→ {tip}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Set global axios default
axios.defaults.headers.common['X-User-ID'] = UID;

// ─── Site Header ──────────────────────────────────────────
// ─── DJ Document Logo Component ──────────────────────────
function LogoDJ({ size = 20, className = "" }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size * 1.8, height: size * 1.8 }}>
      <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-2xl">
        {/* Document Background */}
        <path 
          d="M10 4 H25 L34 13 V34 C34 35.1 33.1 36 32 36 H10 C8.9 36 8 35.1 8 34 V6 C8 4.9 8.9 4 10 4 Z" 
          fill="#cfc9c9"
          stroke="#241c1e"
          strokeWidth="2"
        />
        <path d="M25 4 V13 H34" fill="#cfc9c9" stroke="#241c1e" strokeWidth="2" />
        {/* DJ Text */}
        <text 
          x="21" 
          y="28" 
          textAnchor="middle" 
          className="font-black" 
          style={{ fontSize: '17px', letterSpacing: '-1.5px' }}
        >
          <tspan fill="#e63639">D</tspan>
          <tspan fill="#1da5a2">J</tspan>
        </text>
      </svg>
    </div>
  );
}

// ─── Site Header ──────────────────────────────────────────
function SiteHeader({ onMenuClick, sidebarOpen, isMobile, activeConvId, convTitle, currentView, setView }) {
  return (
    <header className="h-16 shrink-0 z-50 glass-panel border-b border-white/5 px-6 flex items-center justify-between sticky top-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setView('dashboard')}>
          <LogoDJ size={22} className="group-hover:rotate-6 transition-transform" />
          <div className="text-xl font-black tracking-tighter uppercase flex">
            <span className="text-primary">DOC</span>
            <span className="text-secondary">JOCKEY</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <nav className="hidden lg:flex items-center gap-8">
          {[
            { label: 'Home', id: 'dashboard' },
            { label: 'About', id: 'about' },
            { label: 'Contact', id: 'contact' }
          ].map(link => (
            <button 
              key={link.label} 
              onClick={() => setView(link.id)}
              className={`text-xs font-black uppercase tracking-widest transition-colors ${currentView === link.id ? 'text-secondary' : 'text-foreground/40 hover:text-white'}`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all">
            Upgrade Pro
          </button>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
            JD
          </div>
          {isMobile && (
            <button onClick={onMenuClick} className="p-2 text-foreground/60">
              <Menu size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Site Footer ──────────────────────────────────────────
function SiteFooter({ setView }) {
  return (
    <footer className="glass-panel border-t border-white/5 h-16 px-6 w-full relative overflow-hidden flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button onClick={() => setView('dashboard')} className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:scale-105 active:scale-95">
          <LogoDJ size={18} className="group-hover:rotate-3 transition-transform" />
          <div className="text-sm font-black tracking-tighter uppercase flex">
            <span className="text-primary">DOC</span>
            <span className="text-secondary">JOCKEY</span>
          </div>
        </button>
        <div className="h-4 w-px bg-white/10 mx-2" />
        <div className="flex gap-x-6">
          {[
            { label: 'ABOUT US', id: 'about' },
            { label: 'PRIVACY', id: 'privacy' },
            { label: 'DISCLAIMER', id: 'disclaimer' },
            { label: 'CONTACT', id: 'contact' }
          ].map(link => (
            <button 
              key={link.label} 
              onClick={() => setView(link.id)}
              className="text-[9px] font-black text-foreground/30 hover:text-secondary uppercase tracking-[0.2em] transition-all"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:flex items-center justify-center flex-1">
        <span className="text-[8px] font-black text-foreground/20 uppercase tracking-[0.3em] whitespace-nowrap">
          DOCJOCKEY PRO • AGENTIC EXTRACTION &nbsp; | &nbsp; © 2026 DOCJOCKEY
        </span>
      </div>
      
      <div className="flex items-center gap-6">
        <a href="mailto:connect@docjockey.com" className="text-[9px] font-black text-secondary/40 hover:text-secondary uppercase tracking-[0.2em] transition-colors">
          CONNECT@DOCJOCKEY.COM
        </a>
      </div>
    </footer>
  );
}

// ─── Tool Modal (Merge, Split, etc.) ───────────────────────
function ToolModal({ tool, onClose }) {
  const [files, setFiles] = useState([]);
  const [pageRange, setPageRange] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sequence, setSequence] = useState('');
  const [degrees, setDegrees] = useState('90');
  const [isProcessing, setIsProcessing] = useState(false);
  const title = tool.label;

  const handleRun = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (tool.id === 'merge') {
        files.forEach(f => formData.append('files', f));
      } else {
        formData.append('file', files[0]);
        if (tool.id === 'split' && pageRange) formData.append('ranges', pageRange);
        if (tool.id === 'edit' && instructions) formData.append('instructions', instructions);
        if (tool.id === 'rotate') formData.append('degrees', degrees);
        if (tool.id === 'reorder') formData.append('sequence', sequence);
        if (tool.id === 'excel-to-pdf') formData.append('sheets', sequence);
      }

      const response = await axios.post(`${API}/tools/${tool.id}`, formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || `DocJockey_${tool.id}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      onClose();
    } catch (err) {
      console.error("DEBUG - Tool Error:", err);
      let errorMsg = `Efficiency error: ${tool.label} failed.\n\nDetails: ${err.message}`;
      
      if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          const text = await err.response.data.text();
          try {
            const json = JSON.parse(text);
            if (json.error || json.details) errorMsg += `\nBackend: ${json.details || json.error}`;
          } catch (e) {}
        } else if (typeof err.response.data === 'string') {
          errorMsg += `\nBackend: ${err.response.data}`;
        }
      }
      alert(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <tool.icon size={24} />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors group">
            <X size={20} className="text-foreground/40 group-hover:text-white" />
          </button>
        </div>

        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1">
          {files.length === 0 ? (
            <div
              onClick={() => document.getElementById('tool-file-input').click()}
              className="border-2 border-dashed border-white/10 hover:border-primary/40 rounded-3xl p-12 cursor-pointer transition-all text-center group bg-white/2"
            >
              <input
                id="tool-file-input"
                type="file"
                multiple={tool.id === 'merge'}
                accept={
                  tool.id.includes('excel-to') ? '.xlsx, .xls' : 
                  tool.id.includes('word-to') ? '.docx, .doc' : 
                  tool.id.startsWith('pdf-to-') ? '.pdf, .png, .jpg, .jpeg' : '.pdf'
                }
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files))}
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Paperclip size={32} />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground mb-1 uppercase tracking-tight">
                    Select your {
                      tool.id.startsWith('pdf-to-') ? 'PDF or Image' : 
                      tool.id.startsWith('excel-to-') ? 'Excel' : 
                      tool.id.startsWith('word-to-') ? 'Word' : 'PDF'
                    } files
                  </p>
                  <p className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">Drag & drop or click to browse</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate max-w-[200px]">{files[0].name}</p>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Document Selected</p>
                  </div>
                </div>
                <button 
                  onClick={() => setFiles([])}
                  className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {files.length > 1 && (
                <p className="text-[10px] text-foreground/40 text-center italic font-medium">+ {files.length - 1} more files staged</p>
              )}
            </div>
          )}

          {files.length > 0 && tool.id === 'split' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Page Ranges (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. 1-3, 5, 8-10"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-foreground/20 text-foreground"
              />
              <p className="text-[10px] text-foreground/40 px-2 italic font-medium">Leave blank to split into individual pages.</p>
            </div>
          )}

          {files.length > 0 && tool.id === 'edit' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Edit Instructions</label>
              <textarea 
                placeholder="e.g. Change the invoice date to 2024-12-01 and update the vendor name to ABC Corp"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-foreground/20 min-h-[100px] resize-none text-foreground"
              />
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
                <Settings size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary/80 leading-relaxed font-bold uppercase tracking-tight">
                  Smart Redraft generates a clean, standardized document based on your instructions.
                </p>
              </div>
            </div>
          )}

          {files.length > 0 && tool.id === 'rotate' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Rotation Angle</label>
              <div className="flex gap-4">
                {['90', '180', '270'].map(deg => (
                  <button 
                    key={deg} 
                    onClick={() => setDegrees(deg)}
                    className={`flex-1 py-3 rounded-2xl border transition-all text-sm font-black uppercase tracking-widest ${
                      degrees === deg ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/5 text-foreground/40 hover:border-primary/30 hover:text-white'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && tool.id === 'excel-to-pdf' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Target Sheets (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. Sheet1, Sales (Leave blank for all)"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-foreground/20 text-foreground"
              />
            </div>
          )}

          {files.length > 0 && tool.id === 'reorder' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">New Page Sequence</label>
              <input 
                type="text"
                placeholder="e.g. 2, 1, 3"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-foreground/20 text-foreground"
              />
            </div>
          )}
        </div>

        <div className="p-6 bg-surface border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/5">
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={isProcessing || files.length === 0}
            className="flex-1 py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary hover:brightness-110 text-white transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isProcessing ? 'Processing...' : (tool.id === 'edit' ? 'Start Redraft' : `Run ${tool.label}`)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Markdown-lite renderer ──────────────────────────────
function renderContent(text, convId) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code / JSON block
    if (part.startsWith('```')) {
      const lang = part.match(/```(\w+)?/)?.[1] || '';
      const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '').trim();

      // Try to render JSON as a table or multiview dashboard
      if (lang === 'json') {
        try {
          const parsed = JSON.parse(code);
          
          if (parsed && typeof parsed === 'object' && parsed.type === 'multiview') {
             return <AnalysisDashboard key={i} dataObj={parsed} raw={code} convId={convId} />;
          }

          const arr = Array.isArray(parsed) ? parsed : [parsed];
          if (arr.length > 0 && typeof arr[0] === 'object') {
            return <DynamicTable key={i} data={arr} raw={code} convId={convId} />;
          }
        } catch (e) { /* fall through to code block */ }
      }
      return (
        <pre key={i} className="bg-black/40 border border-white/5 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-emerald-400 leading-relaxed shadow-inner">
          {code}
        </pre>
      );
    }

    // Regular text — simple markdown
    const cleanPart = part.replace(/\*\*\*/g, '').replace(/\*\*/g, '');
    
    return (
      <div key={i} className="prose prose-sm max-w-none prose-invert font-medium">
        {cleanPart.split('\n').map((line, j) => {
          if (line.startsWith('### ')) return <h3 key={j} className="text-base font-black text-white mt-1 mb-1 uppercase tracking-tight">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={j} className="text-lg font-black text-white mt-2 mb-1.5 uppercase tracking-tighter">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={j} className="text-2xl font-black text-white mt-3 mb-2 uppercase tracking-tighter">{line.replace('# ', '')}</h1>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="text-sm text-foreground/80 ml-4 mb-0.5 list-disc font-medium">{line.replace(/^[-*] /, '')}</li>;
          if (line.trim() === '') return <div key={j} className="h-1" />;
          return <p key={j} className="text-sm text-foreground/80 leading-relaxed mb-1.5">{line}</p>;
        })}
      </div>
    );
  });
}

// ─── Number/Value Formatter ──────────────────────────────
const formatValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// ─── Dynamic Table (renders ANY JSON array) ──────────────
function DynamicTable({ data, raw, convId, isNested = false }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(null);
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);
  const filename = `docjockey_export_${Date.now()}`;

  const copyJSON = () => {
    navigator.clipboard.writeText(raw || JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCSV = () => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        else if (typeof val === 'object') val = JSON.stringify(val);
        else val = String(val);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFromServer = async (format) => {
    setLoading(format);
    try {
      const response = await axios.post(`/api/export/${format}`, { data, filename }, { responseType: 'blob' });
      const ext = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${filename}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`${isNested ? '' : 'my-1 bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-xl'}`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-5 py-3 border-b border-white/5 bg-white/2 gap-4">
        <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Zap size={14} className="fill-primary/20" /> Structured Extraction • {data.length} records found
        </span>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyJSON} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'JSON'}
          </button>
          <button onClick={() => downloadFromServer('excel')} disabled={loading === 'excel'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-all disabled:opacity-50">
            {loading === 'excel' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Excel (.xlsx)
          </button>
          <button onClick={() => downloadFromServer('word')} disabled={loading === 'word'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all disabled:opacity-50">
            {loading === 'word' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Word (.docx)
          </button>
          <button onClick={downloadCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 transition-all">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => downloadFromServer('pdf')} disabled={loading === 'pdf'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all disabled:opacity-50">
            {loading === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <FileType size={12} />} PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface/95 backdrop-blur-md text-foreground/40 uppercase tracking-widest font-black text-[9px] border-b border-white/5">
              {headers.map(h => (
                <th key={h} className="px-4 py-2 text-left whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors group">
                {headers.map(h => (
                  <td key={h} className="px-4 py-1.5 text-foreground/70 whitespace-nowrap max-w-[250px] truncate group-hover:text-white font-medium">
                    {formatValue(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dynamic Visual Chart (Recharts) ─────────────────────
function DynamicChart({ config }) {
  if (!config || !config.data || !config.data.length || !config.type) return null;

  const { type, data, xAxisKey, yAxisKey } = config;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatValue} cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#ef4444', fontWeight: 'bold' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Bar dataKey={yAxisKey} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatValue} contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#ef4444', fontWeight: 'bold' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Line type="monotone" dataKey={yAxisKey} stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#fff', stroke: '#ef4444' }} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatValue} contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#ef4444', fontWeight: 'bold' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Area type="monotone" dataKey={yAxisKey} stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxisKey} type="category" allowDuplicatedCategory={false} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
            <YAxis dataKey={yAxisKey} type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatValue} cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#ef4444', fontWeight: 'bold' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Scatter name={yAxisKey} data={data} fill="#ef4444" />
          </ScatterChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Tooltip formatter={formatValue} contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Pie data={data} dataKey={yAxisKey} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={120} fill="#ef4444" label>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'][index % 6]} />
              ))}
            </Pie>
          </PieChart>
        );
      default:
        return <div className="p-4 text-center text-foreground/40 text-[10px] uppercase font-black tracking-widest">Unsupported chart type: {type}</div>;
    }
  };

  return (
    <div className="w-full h-[220px] mt-2">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Analysis Dashboard (Multi-View) ──────────────────────────
function AnalysisDashboard({ dataObj, raw, convId }) {
  const [activeTab, setActiveTab] = useState(dataObj.primaryView === 'table' && dataObj.chartConfig ? 'chart' : (dataObj.chartConfig ? 'chart' : 'table'));

  useEffect(() => {
    if (dataObj.primaryView === 'table' && !dataObj.chartConfig) {
      setActiveTab('table');
    } else if (dataObj.primaryView && dataObj.primaryView !== 'table' && dataObj.chartConfig) {
      setActiveTab('chart');
    } else if (dataObj.chartConfig) {
      setActiveTab('chart');
    } else {
      setActiveTab('table');
    }
  }, [dataObj]);

  const hasChart = !!dataObj.chartConfig;
  const hasTable = !!dataObj.tableData;

  return (
    <div className="my-1 bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-5 py-3 border-b border-white/5 bg-white/2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] flex items-center gap-2">
             <BarChart3 size={14} className="text-primary" /> Visual Intelligence Dashboard
          </span>
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
             {hasTable && (
               <button 
                 onClick={() => setActiveTab('table')}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                   activeTab === 'table' ? 'bg-secondary/20 text-secondary' : 'text-foreground/40 hover:text-white'
                 }`}
               >
                 📑 Table Data
               </button>
             )}
             {hasChart && (
               <button 
                 onClick={() => setActiveTab('chart')}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                   activeTab === 'chart' ? 'bg-primary/20 text-primary' : 'text-foreground/40 hover:text-white'
                 }`}
               >
                 📊 Chart View
               </button>
             )}
          </div>
        </div>
        {dataObj.summary && (
          <p className="text-sm text-white/80 leading-relaxed font-medium">
            {dataObj.summary}
          </p>
        )}
      </div>

      <div className="p-2 sm:p-4 bg-black/20">
         {activeTab === 'table' && hasTable && (
            <DynamicTable data={dataObj.tableData} raw={JSON.stringify(dataObj.tableData, null, 2)} convId={convId} isNested={true} />
         )}
         {activeTab === 'chart' && hasChart && (
            <DynamicChart config={dataObj.chartConfig} />
         )}
      </div>
    </div>
  );
}

// ─── Chat Message Bubble ─────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const [showCode, setShowCode] = useState(false);
  
  const attachments = (() => {
    if (Array.isArray(msg.attachments)) return msg.attachments;
    try { return JSON.parse(msg.attachments || '[]'); } catch { return []; }
  })();

  const pythonAttachment = attachments.find(a => a.type === 'python_code');
  const fileAttachments = attachments.filter(a => typeof a === 'string');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mt-1 shadow-lg transition-transform hover:scale-105 ${
          isUser ? 'bg-primary text-white' : 'bg-surface border border-white/10 text-foreground'
        }`}>
          {isUser ? <User size={20} /> : <Zap size={20} fill={!isUser && pythonAttachment ? "currentColor" : "none"} className={!isUser ? "text-primary" : ""} />}
        </div>
        {!isUser && pythonAttachment && (
          <span className="text-[7px] font-black bg-primary text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
            Analyst
          </span>
        )}
      </div>
      <div className={`w-full max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {fileAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {fileAttachments.map((name, i) => (
              <span key={i} className="flex items-center gap-2 text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border border-primary/20 shadow-sm">
                <FileText size={12} /> {name}
              </span>
            ))}
          </div>
        )}
        <div className={isUser ? "user-bubble" : "ai-bubble"}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
          ) : (
            <div className="space-y-1">
              <div className="font-outfit">{renderContent(msg.content, msg.conversation_id)}</div>
              
              {pythonAttachment && (
                <div className="pt-2">
                  <button 
                    onClick={() => setShowCode(!showCode)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-white transition-colors"
                  >
                    <Code size={12} />
                    {showCode ? 'Hide Analysis Code' : 'Show Analysis Code'}
                    {showCode ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  
                  <AnimatePresence>
                    {showCode && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="bg-black/40 rounded-xl p-4 border border-white/5 font-mono text-[11px] text-foreground/80 overflow-x-auto whitespace-pre">
                          <code>{pythonAttachment.code}</code>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-foreground/20 mt-2 px-2 font-black uppercase tracking-widest">
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </motion.div>
  );
}

function BulkMergerView({ setView }) {
  const [files, setFiles] = useState([]);
  const [stage, setStage] = useState('selection'); // selection, analyzing, config, processing, result
  const [analysis, setAnalysis] = useState(null);
  const [config, setConfig] = useState({ sheet: {}, columns: [], mode: null, ai_instructions: '', output_format: 'xlsx' });
  const [resultUrl, setResultUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleFileDrop = (e) => {
    const dropped = Array.from(e.target.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const startAnalysis = async () => {
    setStage('analyzing');
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    
    try {
      const { data } = await axios.post(`${API}/batch/analyze`, formData);
      setAnalysis(data.files);
      
      // Auto-set default sheet for all files with sheets
      const initialSheets = {};
      data.files.forEach(f => {
        if (f.sheets && f.sheets.length > 0) {
          initialSheets[f.path] = f.sheets[0];
        }
      });
      const commonColumns = data.files[0]?.columns || [];
      
      setConfig({ 
        sheet: initialSheets, 
        columns: commonColumns,
        mode: null,
        ai_instructions: '',
        output_format: 'xlsx'
      });
      setStage('config');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStage('selection');
    }
  };

  const runMerge = async () => {
    setStage('processing');
    try {
      const { data } = await axios.post(`${API}/batch/execute`, {
        files: analysis,
        sheet_name: config.sheet,
        columns: config.columns,
        mode: config.mode || 'strict',
        ai_instructions: config.ai_instructions,
        output_format: config.output_format || 'xlsx'
      });
      setResultUrl(data.downloadUrl);
      setStage('result');
    } catch (err) {
      console.error("Execution Error:", err.response?.data);
      const errorData = err.response?.data;
      setError({
        message: errorData?.error || err.message,
        details: errorData?.details || ''
      });
      setStage('config');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-10 max-w-5xl mx-auto w-full min-h-screen"
    >
      <div className="mb-6">
        <button onClick={() => setView('dashboard')} className="text-[10px] font-black text-secondary/60 hover:text-secondary uppercase tracking-[0.3em] mb-4 flex items-center gap-2 transition-colors">
          ← Back to Dashboard
        </button>
        <div className="flex items-center gap-4 mb-2">
           <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <Shuffle size={20} />
           </div>
           <div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">Bulk Excel/CSV Merger</h2>
              <p className="text-foreground/40 text-[9px] font-black uppercase tracking-widest mt-0.5">Enterprise Power Engine • 100k+ Row Capacity</p>
           </div>
        </div>
        <div className="w-16 h-1 bg-secondary rounded-full mb-6" />
      </div>

      <div className="glass-panel p-6 min-h-[350px] flex flex-col">
        {stage === 'selection' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6 p-3.5 bg-secondary/5 border border-secondary/20 rounded-2xl flex items-start gap-4">
               <Bot size={18} className="text-secondary shrink-0 mt-0.5" />
               <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                 Welcome to the **Bulk Merger**. This tool is designed for massive datasets (Up to 10 files). I will merge them into a single high-performance output.
               </p>
            </div>

            <div 
              onClick={() => document.getElementById('bulk-file-input').click()}
              className="flex-1 border-2 border-dashed border-white/10 hover:border-secondary/40 rounded-3xl p-8 cursor-pointer transition-all text-center group bg-white/2 flex flex-col items-center justify-center"
            >
              <input id="bulk-file-input" type="file" multiple accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileDrop} />
              <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
                <Plus size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Stage Your Files</h3>
              <p className="text-[11px] text-foreground/40 font-medium italic">Drag & drop your spreadsheets here (Max 10 files)</p>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{files.length} Files Staged</p>
                  <button onClick={() => setFiles([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest">Clear All</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 bg-white/5 border border-white/5 rounded-xl">
                      <FileSpreadsheet size={14} className="text-secondary" />
                      <span className="text-[10px] font-medium truncate flex-1">{f.name}</span>
                      <span className="text-[8px] font-black text-foreground/20 uppercase">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={startAnalysis}
                  className="w-full mt-6 py-4 bg-secondary text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-secondary/20 hover:brightness-110 transition-all"
                >
                  Start AI Configuration →
                </button>
              </div>
            )}
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 relative mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin" />
              <div className="absolute inset-4 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <Sparkles size={16} />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">AI Sniff Test in Progress</h3>
            <p className="text-sm text-foreground/40 font-medium italic">Analyzing headers, sheets, and data patterns...</p>
          </div>
        )}

        {stage === 'config' && analysis && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8 space-y-4">
               <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-2xl flex items-start gap-4">
                  <Bot size={20} className="text-secondary shrink-0 mt-1" />
                  <div className="space-y-3">
                    <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                      I've analyzed your files. To ensure a perfect merge, please confirm the configuration:
                    </p>
                    
                    {/* Sheet Selection (if Excel files have >1 sheets) */}
                    {analysis.filter(f => f.sheets && f.sheets.length > 1).length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Target Sheets (Multi-Sheet Files)</label>
                        {analysis.filter(f => f.sheets && f.sheets.length > 1).map((file, idx) => (
                           <div key={idx} className="space-y-2 p-3 bg-white/5 border border-white/10 rounded-xl">
                             <p className="text-[11px] font-bold text-white">File: {file.filename || file.name}</p>
                             <div className="flex flex-wrap gap-2">
                               {file.sheets.map(s => (
                                 <button
                                   key={s}
                                   onClick={() => setConfig(prev => ({ ...prev, sheet: { ...prev.sheet, [file.path]: s } }))}
                                   className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                                     config.sheet[file.path] === s ? 'bg-secondary text-white border-secondary' : 'bg-transparent border-white/20 text-foreground/40 hover:border-white/50 hover:text-white'
                                   }`}
                                 >
                                   {s}
                                 </button>
                               ))}
                             </div>
                           </div>
                        ))}
                      </div>
                    )}

                    {/* Column Selection Mode Toggle */}
                    <div className="space-y-3 mt-4 pt-6 border-t border-white/5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3 block">Column Mapping Mode</label>
                      <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, mode: 'strict' }))}
                          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border text-left ${
                            config.mode === 'strict'
                              ? 'bg-secondary text-white border-secondary shadow-lg'
                              : 'bg-transparent text-foreground/60 border-white/10 hover:border-white/30 hover:text-white'
                          }`}
                        >
                          Manual / Strict Match
                          <span className={`block text-[8px] font-normal normal-case mt-1 ${config.mode === 'strict' ? 'text-white/80' : 'text-foreground/40'}`}>Select from identical headers</span>
                        </button>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, mode: 'ai' }))}
                          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border text-left flex items-start justify-between gap-2 ${
                            config.mode === 'ai'
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                              : 'bg-transparent text-foreground/60 border-white/10 hover:border-primary/50 hover:text-white'
                          }`}
                        >
                           <div>
                             DocJockey AI Mapping
                             <span className={`block text-[8px] font-normal normal-case mt-1 ${config.mode === 'ai' ? 'text-white/80' : 'text-foreground/40'}`}>Map different headers</span>
                           </div>
                           <Sparkles size={14} className={config.mode === 'ai' ? 'animate-pulse text-white mt-1' : 'text-primary/50 mt-1'} />
                        </button>
                      </div>

                      {/* Manual Mode UI */}
                      {config.mode === 'strict' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                          <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-2 block">Available Columns</label>
                          <div className="flex flex-wrap gap-2">
                            {analysis[0]?.columns?.map(col => (
                              <button
                                key={col}
                                onClick={() => {
                                  const exists = config.columns.includes(col);
                                  setConfig(prev => ({
                                    ...prev,
                                    columns: exists ? prev.columns.filter(c => c !== col) : [...prev.columns, col]
                                  }));
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                                  config.columns.includes(col) ? 'bg-secondary text-white border-secondary' : 'bg-white/5 border-white/5 text-foreground/40 hover:border-white/20'
                                }`}
                              >
                                {col}
                              </button>
                            ))}
                          </div>
                          <p className="text-[9px] text-foreground/30 italic mt-2">Click to toggle columns. Only selected columns will be present in the final merge.</p>
                        </div>
                      )}

                      {/* AI Mode UI */}
                      {config.mode === 'ai' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300 border border-primary/20 bg-primary/5 rounded-xl p-4">
                           <label className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Sparkles size={12} /> Mapping Instructions
                           </label>
                           <textarea
                             value={config.ai_instructions || ''}
                             onChange={(e) => setConfig(prev => ({ ...prev, ai_instructions: e.target.value }))}
                             placeholder="e.g., 'Merge Rate and Price into Unit Price. Merge Items and Goods into Product Name.'"
                             className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 custom-scrollbar resize-none"
                           />
                           <p className="text-[9px] text-primary/60 italic mt-3 leading-relaxed">
                             DocJockey AI will analyze the headers of all files and compile a mapping schema based on your instructions before executing the high-speed merge.
                           </p>
                        </div>
                      )}
                    </div>

                    {/* Output Format Toggle */}
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3 block">Output Format</label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, output_format: 'xlsx' }))}
                          className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all border-2 ${
                            config.output_format === 'xlsx'
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                              : 'bg-transparent text-foreground/60 border-primary/40 hover:border-primary hover:text-white'
                          }`}
                        >
                          📊 Excel (.xlsx)
                        </button>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, output_format: 'csv' }))}
                          className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all border-2 ${
                            config.output_format === 'csv'
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                              : 'bg-transparent text-foreground/60 border-primary/40 hover:border-primary hover:text-white'
                          }`}
                        >
                          📄 CSV (.csv)
                        </button>
                      </div>
                    </div>
                  </div>
               </div>
            </div>

            <div className="mt-auto pt-8 border-t border-white/5">
              <button 
                onClick={runMerge}
                disabled={!config.mode}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                   config.mode 
                    ? 'bg-secondary text-white shadow-xl shadow-secondary/20 hover:brightness-110' 
                    : 'bg-white/5 text-foreground/20 cursor-not-allowed border border-white/5'
                }`}
              >
                <Shuffle size={18} /> Execute Enterprise Merge
              </button>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Engaging Document Engine</span>
                    <span className="text-[10px] font-black text-secondary animate-pulse uppercase tracking-[0.2em]">Processing...</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "95%" }}
                        transition={{ duration: 15, ease: "linear" }}
                        className="h-full bg-secondary"
                    />
                </div>
                <p className="text-[10px] text-foreground/30 text-center mt-6 uppercase tracking-widest leading-relaxed">
                    Merging dataframes • Optimizing memory • Finalizing workbook
                </p>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-3xl flex items-center justify-center mb-8 border border-green-500/20">
                <Check size={48} />
             </div>
             <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Merge Complete!</h3>
             <p className="text-sm text-foreground/40 font-medium mb-12">Your enterprise-grade dataset is ready for download.</p>
             
             <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <a 
                  href={resultUrl}
                  download
                  className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-center shadow-xl shadow-green-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download (.{(config.output_format || 'xlsx').toUpperCase()})
                </a>
                <button 
                  onClick={() => { setStage('selection'); setFiles([]); setResultUrl(null); }}
                  className="px-8 py-4 bg-white/5 text-foreground/60 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                >
                  Done
                </button>
             </div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in slide-in-from-top-2">
             <div className="flex items-center gap-4 text-red-500 mb-4">
               <X size={20} className="shrink-0" />
               <p className="text-sm font-bold uppercase tracking-tight flex-1">{error.message || error}</p>
               <button onClick={() => setError(null)} className="text-[10px] font-black uppercase underline tracking-widest">Dismiss</button>
             </div>
             {error.details && (
               <div className="bg-black/40 rounded-xl p-4 overflow-x-auto custom-scrollbar border border-white/5">
                 <pre className="text-[10px] font-mono text-red-400/80 leading-relaxed">
                   {error.details}
                 </pre>
               </div>
             )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main App ────────────────────────────────────────────
export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  const [activeTool, setActiveTool] = useState(null);
  const [uploadMode, setUploadMode] = useState('single');
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainArea = document.querySelector('main');
    if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAction = (activeFn) => {
    if (activeFn) activeFn();
    if (isMobile) setSidebarOpen(false);
  };

  // Load conversations
  useEffect(() => {
    axios.get(`${API}/conversations`).then(r => setConversations(r.data)).catch(() => {});
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    
    // Find conversation to set the correct mode
    const currentConv = conversations.find(c => c.id === activeConvId);
    if (currentConv) {
      setIsAnalysisMode(currentConv.type === 'analysis');
    }

    axios.get(`${API}/conversations/${activeConvId}/messages`)
      .then(r => setMessages(r.data))
      .catch(() => {});
  }, [activeConvId, conversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Create new conversation
  const newChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setAttachedFiles([]);
    setInputText('');
  };

  // Send message
  const sendMessage = async () => {
    if (!inputText.trim() && attachedFiles.length === 0) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('message', inputText);
    if (activeConvId) formData.append('conversation_id', activeConvId);
    attachedFiles.forEach(f => formData.append('files', f));

    // Optimistic UI: show user message immediately
    const tempUserMsg = {
      role: 'user',
      content: inputText,
      attachments: attachedFiles.map(f => f.name),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText('');
    setAttachedFiles([]);

    try {
      // Determine endpoint based on conversation type
      const currentConv = conversations.find(c => c.id === activeConvId);
      const isAnalysis = currentConv?.type === 'analysis' || isAnalysisMode;
      const endpoint = isAnalysis ? `${API}/analyze-data` : `${API}/chat`;

      const { data } = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Set active conversation
      if (!activeConvId) {
        setActiveConvId(data.conversation_id);
      }

      // Add AI response
      const aiMsg = {
        role: 'model',
        content: data.response,
        attachments: data.python_code ? [{ type: 'python_code', code: data.python_code }] : [],
        python_code: data.python_code, // Store locally as well
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Refresh conversations list
      axios.get(`${API}/conversations`).then(r => setConversations(r.data)).catch(() => {});
    } catch (err) {
      const errorMsg = {
        role: 'model',
        content: `⚠️ Error: ${err.response?.data?.details || err.message}`,
        attachments: '[]',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete conversation
  const deleteConv = (id, e) => {
    e.stopPropagation();
    axios.delete(`${API}/conversations/${id}`).then(() => {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvId === id) newChat();
    });
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 overflow-hidden">
      <SiteHeader 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        sidebarOpen={sidebarOpen} 
        isMobile={isMobile}
        activeConvId={activeConvId}
        convTitle={messages.length > 0 ? (conversations.find(c => c.id === activeConvId)?.title || 'Chat') : 'New Session'}
        currentView={currentView}
        setView={setCurrentView}
      />

      <div className="flex-1 flex overflow-hidden relative">

        {/* ─── Sidebar Layer ─── */}
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (sidebarOpen || !isMobile) && (
            <motion.aside
              initial={isMobile ? { x: -300 } : false}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`
                ${isMobile ? 'fixed inset-y-0 left-0 z-[60] w-64' : 'relative w-64 shrink-0'} 
                flex flex-col glass-panel border-r border-white/5 h-full overflow-hidden
              `}
            >
              {/* Sidebar Header (Internal) - New Chat Button */}
              <div className="p-4 shrink-0 border-b border-white/5">
                <button
                  onClick={() => handleAction(newChat)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 red-gradient rounded-2xl text-[10px] font-black text-white shadow-xl shadow-primary/20 hover:brightness-110 transition-all uppercase tracking-[0.2em]"
                >
                  <Plus size={16} /> New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-4">
                {/* --- Intelligence --- */}
                <div>
                  <p className="px-3 text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4 mt-2">Intelligence</p>
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => handleAction(() => setActiveConvId(conv.id))}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between group transition-all ${
                          activeConvId === conv.id ? 'bg-white/5 text-primary border border-white/5' : 'text-foreground/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {conv.type === 'analysis' ? (
                            <Zap size={13} className="shrink-0 text-primary" fill="currentColor" />
                          ) : (
                            <FileSpreadsheet size={13} className="shrink-0 opacity-40" />
                          )}
                          <span className="text-[11px] font-medium truncate">{conv.title}</span>
                        </div>
                        <button
                          onClick={(e) => deleteConv(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-all"
                        >
                          <Trash2 size={10} className="text-red-400" />
                        </button>
                      </button>
                    ))}
                  </div>
                </div>

                {/* --- Enterprise Bulk Suite --- */}
                <div className="mb-6">
                  <p className="px-3 text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3 mt-2">Enterprise Bulk Suite</p>
                  <div className="space-y-2 flex justify-center">
                    <div className={`p-[3px] rounded-[40px] transition-all ${currentView === 'bulk-merger' ? 'bg-white' : 'bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/10'}`}>
                      <button
                        onClick={() => handleAction(() => setCurrentView('bulk-merger'))}
                        className={`w-36 h-36 flex flex-col items-center justify-center p-4 rounded-[37px] transition-all ${
                          currentView === 'bulk-merger' 
                          ? 'bg-primary text-white scale-95' 
                          : 'bg-surface hover:bg-white/5 text-foreground/60 hover:text-white'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all mb-3 ${
                          currentView === 'bulk-merger' ? 'bg-white/20' : 'red-gradient text-white shadow-lg shadow-primary/20 group-hover:scale-110'
                        }`}>
                          <Shuffle size={24} />
                        </div>
                        <div className="text-center">
                          <p className={`text-[13px] font-black uppercase tracking-tight leading-tight ${currentView === 'bulk-merger' ? 'text-white' : 'text-foreground/90'}`}>Bulk Merger</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${currentView === 'bulk-merger' ? 'text-white/60' : 'text-primary'}`}>Excel / CSV</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- Tools by Category --- */}
                {[
                  {
                    title: 'File Manipulation',
                    tools: [
                      { id: 'merge', icon: Combine, label: 'Merge PDF' },
                      { id: 'split', icon: Scissors, label: 'Split PDF' },
                      { id: 'compress', icon: Minimize2, label: 'Compress PDF' },
                      { id: 'repair', icon: Eraser, label: 'Repair PDF' },
                    ]
                  },
                  {
                    title: 'Conversion',
                    tools: [
                      { id: 'pdf-to-word', icon: FileType, label: 'PDF to Word' },
                      { id: 'pdf-to-excel', icon: FileSpreadsheet, label: 'PDF to Excel' },
                      { id: 'excel-to-pdf', icon: ArrowRightLeft, label: 'Excel to PDF' },
                      { id: 'word-to-pdf', icon: FileText, label: 'Word to PDF' },
                    ]
                  },
                  {
                    title: 'Core Editing',
                    tools: [
                      { id: 'edit', icon: Type, label: 'A.I. Smart Redraft' },
                    ]
                  },
                  {
                    title: 'Page Organization',
                    tools: [
                      { id: 'rotate', icon: RotateCw, label: 'Rotate Pages' },
                      { id: 'reorder', icon: Layout, label: 'Organize Pages' },
                    ]
                  }
                ].map(category => category.tools.length > 0 && (
                  <div key={category.title} className="mb-6">
                    <p className="px-3 text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">{category.title}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {category.tools.map(tool => (
                        <button
                          key={tool.id}
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-secondary/20 transition-all group gap-2"
                          onClick={() => tool.action ? tool.action() : handleAction(() => setActiveTool(tool))}
                        >
                          <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${tool.id === 'new' ? 'red-gradient text-white shadow-lg shadow-primary/20' : 'bg-surface/50 text-foreground/30 group-hover:text-secondary group-hover:bg-secondary/10 border border-white/5'}`}>
                            <tool.icon size={16} />
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight text-foreground/40 group-hover:text-white transition-colors px-1">
                            {tool.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ─── Main Content Area ─── */}
        <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex-1">
              {currentView === 'bulk-merger' ? (
                <BulkMergerView setView={setCurrentView} />
              ) : currentView === 'dashboard' ? (
                messages.length === 0 ? (
                  /* Empty State / Welcome */
                  <div className="flex-1 flex flex-col items-center justify-center p-4 pt-8 pb-8 min-h-0">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center w-full max-w-screen-xl px-4"
                    >
                      <div className="w-16 h-16 mb-4 shadow-2xl shadow-primary/10 flex items-center justify-center mx-auto transition-transform hover:scale-110 duration-500">
                        <LogoDJ size={36} />
                      </div>
                      <h2 className="text-base font-black mb-6 tracking-tight uppercase">Welcome to the DocJockey Master.</h2>
                      
                      {/* --- Welcome State Mode Selection --- */}
                      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-screen-xl mx-auto mb-8">
                        {/* Master Extractor Card */}
                        <div 
                          onClick={() => setIsAnalysisMode(false)}
                          className={`flex-1 p-4 rounded-2xl cursor-pointer transition-all duration-500 border-2 group ${
                            !isAnalysisMode 
                            ? 'bg-primary/10 border-primary shadow-2xl shadow-primary/20 scale-[1.02]' 
                            : 'bg-surface/30 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 hover:border-primary/30'
                          }`}
                        >
                           <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                               !isAnalysisMode ? 'bg-primary text-white shadow-lg' : 'bg-surface border-white/10 text-foreground/40'
                             }`}>
                               <Layout size={24} />
                             </div>
                             <div className="text-left">
                               <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">Master Extractor</h3>
                               <p className="text-[10px] text-foreground/40 font-medium leading-tight uppercase tracking-widest hidden md:block">
                                 Table detection • Batch merging
                               </p>
                             </div>
                           </div>
                        </div>

                        {/* Data Analyst Card */}
                        <div 
                          onClick={() => setIsAnalysisMode(true)}
                          className={`flex-1 p-4 rounded-2xl cursor-pointer transition-all duration-500 border-2 group ${
                            isAnalysisMode 
                            ? 'bg-primary/10 border-primary shadow-2xl shadow-primary/20 scale-[1.02]' 
                            : 'bg-surface/30 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 hover:border-primary/30'
                          }`}
                        >
                           <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                               isAnalysisMode ? 'bg-primary text-white shadow-lg' : 'bg-surface border-white/10 text-foreground/40'
                             }`}>
                               <Zap size={24} fill={isAnalysisMode ? 'currentColor' : 'none'} />
                             </div>
                             <div className="text-left">
                               <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">Visual Analyst</h3>
                               <p className="text-[10px] text-foreground/40 font-medium leading-tight uppercase tracking-widest hidden md:block">
                                 Python engine • Visualization
                               </p>
                             </div>
                           </div>
                        </div>
                      </div>

                      {!isAnalysisMode && (
                        <div className="flex bg-surface/50 p-1 rounded-xl border border-white/5 mb-6 max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <button 
                            onClick={() => { setUploadMode('single'); setAttachedFiles([]); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${uploadMode === 'single' ? 'bg-primary text-white shadow-lg' : 'text-foreground/30 hover:text-white'}`}
                          >
                            <FileText size={12} /> Single
                          </button>
                          <button 
                            onClick={() => { setUploadMode('multiple'); setAttachedFiles([]); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${uploadMode === 'multiple' ? 'bg-primary text-white shadow-lg' : 'text-foreground/30 hover:text-white'}`}
                          >
                            <Layout size={12} /> Batch
                          </button>
                        </div>
                      )}

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-screen-xl border-2 border-dashed border-white/5 hover:border-primary/20 rounded-2xl p-4 cursor-pointer transition-all duration-500 group bg-surface/10 hover:bg-surface/20 mx-auto mb-8"
                      >
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-12 h-12 bg-primary/5 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform border border-primary/10">
                            {uploadMode === 'single' ? <Paperclip size={24} /> : <Combine size={24} />}
                          </div>
                          <div className="text-left">
                            <p className="text-base font-black text-white uppercase tracking-[0.2em]">
                              {isAnalysisMode ? 'Drop Data File' : (uploadMode === 'single' ? 'Drop document' : 'Drop batch')}
                            </p>
                            <p className="text-[10px] text-secondary font-black uppercase tracking-[0.2em]">
                              {isAnalysisMode ? 'Excel / CSV Priority' : 'Ready for DocJockey Speed'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* --- Welcome State Dialogue Box (Embedded) --- */}
                      <div className="max-w-screen-xl mx-auto mb-8">
                         {/* Reusable Input Block */}
                         <ChatInputArea 
                            inputText={inputText}
                            setInputText={setInputText}
                            sendMessage={sendMessage}
                            handleKeyDown={handleKeyDown}
                            handleFileSelect={handleFileSelect}
                            fileInputRef={fileInputRef}
                            attachedFiles={attachedFiles}
                            setAttachedFiles={setAttachedFiles}
                            isLoading={isLoading}
                            isEmbedded={true}
                            isAnalysisMode={isAnalysisMode}
                            setIsAnalysisMode={setIsAnalysisMode}
                         />
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="max-w-screen-2xl mx-auto p-4 space-y-4 py-4">
                    {messages.map((msg, i) => (
                      <ChatMessage key={i} msg={msg} />
                    ))}
                    {isLoading && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-surface border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                          <Loader2 size={18} className="animate-spin text-primary" />
                        </div>
                        <div className="bg-surface/30 border border-white/5 rounded-2xl px-6 py-5 shadow-sm">
                          <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] animate-pulse">Running DocJockey Engine...</span>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )
              ) : (
                <div className="flex flex-col">
                  {currentView === 'about' && <AboutView />}
                  {currentView === 'privacy' && <PrivacyView />}
                  {currentView === 'disclaimer' && <DisclaimerView />}
                  {currentView === 'contact' && <ContactView />}
                  {currentView === 'howto' && <HowItWorksView setView={setCurrentView} />}
                </div>
              )}
            </div>
          </div>

          {/* Floating Input Area (Sticky Overlay - only when chat is active) */}
          <AnimatePresence>
            {currentView === 'dashboard' && messages.length > 0 && (
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="sticky bottom-0 p-2 md:p-3 shrink-0 bg-background/80 backdrop-blur-xl border-t border-white/5 z-40"
              >
                <div className="max-w-screen-2xl mx-auto">
                   <ChatInputArea 
                      inputText={inputText}
                      setInputText={setInputText}
                      sendMessage={sendMessage}
                      handleKeyDown={handleKeyDown}
                      handleFileSelect={handleFileSelect}
                      fileInputRef={fileInputRef}
                      attachedFiles={attachedFiles}
                      setAttachedFiles={setAttachedFiles}
                      isLoading={isLoading}
                      isAnalysisMode={isAnalysisMode}
                      setIsAnalysisMode={setIsAnalysisMode}
                   />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <SiteFooter setView={setCurrentView} />

      {activeTool && <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} />}
    </div>
  );
}

// ─── Reusable Chat Input Component ────────────────────────
function ChatInputArea({ 
  inputText, 
  setInputText, 
  sendMessage, 
  handleKeyDown, 
  handleFileSelect, 
  fileInputRef, 
  attachedFiles, 
  setAttachedFiles,
  isLoading,
  isEmbedded = false,
  isAnalysisMode = false,
  setIsAnalysisMode
}) {
  return (
    <div className="w-full">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {attachedFiles.map((file, i) => (
            <span key={i} className="flex items-center gap-3 text-[10px] font-black uppercase leading-none bg-primary/10 text-primary border border-primary/20 px-4 py-2.5 rounded-xl shadow-lg">
              <FileText size={14} />
              {file.name}
              <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-white ml-2 transition-colors">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 md:gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 md:p-3 text-foreground/30 hover:text-white hover:bg-white/5 rounded-xl transition-all shrink-0 border border-white/5 shadow-md bg-surface/30"
        >
          <Paperclip size={18} />
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        </button>

        <div className="flex-1 bg-surface/50 border border-white/10 rounded-2xl focus-within:border-primary/40 transition-all overflow-hidden shadow-xl">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAnalysisMode ? "e.g., Clean this data, plot revenue by region..." : (isEmbedded ? "Ask DocJockey to analyze or extract..." : "Send a message...")}
            rows={1}
            className="w-full bg-transparent px-4 py-3 text-sm outline-none resize-none placeholder:text-foreground/20 max-h-32 leading-relaxed font-medium"
            style={{ minHeight: '44px' }}
          />
        </div>

        <button
          onClick={sendMessage}
          disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
          className="p-3 md:p-3.5 red-gradient text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed shrink-0 shadow-xl shadow-primary/30 border border-white/10"
        >
          <Send size={18} />
        </button>
      </div>

    </div>
  );
}
