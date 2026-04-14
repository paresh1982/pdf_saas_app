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
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

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

// Set global axios default
axios.defaults.headers.common['X-User-ID'] = UID;

// ─── Site Header ──────────────────────────────────────────
function SiteHeader({ onMenuClick, sidebarOpen, isMobile, activeConvId, convTitle }) {
  return (
    <header className="h-16 shrink-0 z-50 glass-panel border-b border-white/5 px-6 flex items-center justify-between sticky top-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-9 h-9 red-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <div className="text-xl font-black tracking-tighter uppercase flex">
            <span className="text-primary">DOC</span>
            <span className="text-secondary">JOCKEY</span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-6 ml-8">
          {[
            { label: 'Home', href: '#' },
            { label: 'Pricing', href: '#' },
            { label: 'About', href: '#' },
            { label: 'Contact', href: '#' }
          ].map(link => (
            <a key={link.label} href={link.href} className="text-xs font-black text-foreground/40 hover:text-white uppercase tracking-widest transition-colors">{link.label}</a>
          ))}
        </nav>
      </div>

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
    </header>
  );
}

// ─── Site Footer ──────────────────────────────────────────
function SiteFooter() {
  const sections = [
    { title: 'Connect', links: ['Support', 'Sales', 'Status'] },
    { title: 'Learn', links: ['Docs', 'Features', 'Blog'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'GDPR'] },
    { title: 'Company', links: ['About Us', 'Careers'] }
  ];

  return (
    <footer className="bg-background shrink-0 border-t border-white/5 pt-12 pb-8 px-6 mt-12 w-full">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-x-12 gap-y-4">
        {[
          { label: 'About Us', href: '#' },
          { label: 'Contact', href: '#' },
          { label: 'Privacy Policy', href: '#' },
          { label: 'Disclaimer', href: '#' }
        ].map(link => (
          <a key={link.label} href={link.href} className="text-[10px] font-black text-foreground/40 hover:text-secondary uppercase tracking-[0.2em] transition-colors">
            {link.label}
          </a>
        ))}
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-secondary font-black uppercase tracking-[0.5em]">
        <span>© 2026 DOCJOCKEY AI • Agentic Parsing Engine</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white">Twitter</a>
          <a href="#" className="hover:text-white">Github</a>
          <a href="#" className="hover:text-white">LinkedIn</a>
        </div>
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

      // Try to render JSON as a table
      if (lang === 'json') {
        try {
          const parsed = JSON.parse(code);
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
          if (line.startsWith('### ')) return <h3 key={j} className="text-base font-black text-white mt-6 mb-2 uppercase tracking-tight">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={j} className="text-lg font-black text-white mt-8 mb-3 uppercase tracking-tighter">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={j} className="text-2xl font-black text-white mt-10 mb-4 uppercase tracking-tighter">{line.replace('# ', '')}</h1>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="text-sm text-foreground/80 ml-4 mb-1 list-disc font-medium">{line.replace(/^[-*] /, '')}</li>;
          if (line.trim() === '') return <div key={j} className="h-4" />;
          return <p key={j} className="text-sm text-foreground/80 leading-relaxed mb-3">{line}</p>;
        })}
      </div>
    );
  });
}

// ─── Dynamic Table (renders ANY JSON array) ──────────────
function DynamicTable({ data, raw, convId }) {
  const [copied, setCopied] = useState(false);
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

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
    a.href = url;
    a.download = `docjockey_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(raw || JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 gap-4">
        <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Zap size={14} className="fill-primary/20" /> Structured Extraction • {data.length} records found
        </span>
        <div className="flex gap-2">
          <button onClick={copyJSON} className="view-btn">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button onClick={downloadCSV} className="view-btn">
            <Download size={12} /> Download CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface/95 backdrop-blur-md text-foreground/40 uppercase tracking-widest font-black text-[9px] border-b border-white/5">
              {headers.map(h => (
                <th key={h} className="px-6 py-4 text-left whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors group">
                {headers.map(h => (
                  <td key={h} className="px-6 py-4 text-foreground/70 whitespace-nowrap max-w-[250px] truncate group-hover:text-white font-medium">
                    {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h] ?? '—')}
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

// ─── Chat Message Bubble ─────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const attachments = (() => {
    try { return JSON.parse(msg.attachments || '[]'); } catch { return []; }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-1 shadow-lg transition-transform hover:scale-105 ${
        isUser ? 'bg-primary text-white' : 'bg-surface border border-white/10 text-foreground'
      }`}>
        {isUser ? <User size={20} /> : <Zap size={20} className={!isUser ? "text-primary" : ""} />}
      </div>
      <div className={`w-full max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((name, i) => (
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
            <div>{renderContent(msg.content, msg.conversation_id)}</div>
          )}
        </div>
        <p className="text-[10px] text-foreground/20 mt-2 px-2 font-black uppercase tracking-widest">
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main App ────────────────────────────────────────────
export default function App() {
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
    axios.get(`${API}/conversations/${activeConvId}/messages`)
      .then(r => setMessages(r.data))
      .catch(() => {});
  }, [activeConvId]);

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
      attachments: JSON.stringify(attachedFiles.map(f => f.name)),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText('');
    setAttachedFiles([]);

    try {
      const { data } = await axios.post(`${API}/chat`, formData, {
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
        attachments: '[]',
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
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <SiteHeader 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        sidebarOpen={sidebarOpen}
        isMobile={isMobile}
        activeConvId={activeConvId}
        convTitle={activeConvId ? conversations.find(c => c.id === activeConvId)?.title : ''}
      />

      <div className="flex flex-1 overflow-hidden relative">

        {/* ─── Sidebar Layer ─── */}
        <AnimatePresence mode="wait">
          {(sidebarOpen || !isMobile) && (
            <motion.aside
              initial={isMobile ? { x: -300 } : false}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`
                ${isMobile ? 'fixed inset-y-0 left-0 z-[60] w-72' : 'relative w-64'} 
                flex flex-col glass-panel border-r border-white/5
              `}
            >
              {/* Sidebar Header (Internal) - New Chat Button */}
              <div className="p-3 mt-4">
                <button
                  onClick={() => handleAction(newChat)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 red-gradient rounded-xl text-xs font-bold text-white shadow-lg shadow-primary/10 hover:brightness-110 transition-all uppercase tracking-widest"
                >
                  <Plus size={16} /> New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-2 border-t border-white/5 mt-4">
                {/* --- Intelligence --- */}
                <div>
                  <p className="px-3 text-[10px] font-bold text-foreground/20 uppercase tracking-widest mb-2 mt-2 font-black tracking-[0.2em]">Intelligence</p>
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => handleAction(() => setActiveConvId(conv.id))}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all ${
                          activeConvId === conv.id ? 'bg-white/5 text-primary border border-white/5' : 'text-foreground/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MessageSquarePlus size={14} className="shrink-0" />
                          <span className="text-xs font-medium truncate">{conv.title}</span>
                        </div>
                        <button
                          onClick={(e) => deleteConv(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                        >
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </button>
                    ))}
                  </div>
                </div>

                {/* --- Tools by Category --- */}
                {[
                  {
                    title: 'Intelligence',
                    tools: conversations.length > 0 ? [
                      { id: 'new', icon: Plus, label: 'New Chat', action: () => handleAction(newChat) }
                    ] : []
                  },
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
                  <div key={category.title} className="mb-8">
                    <p className="px-3 text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">{category.title}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {category.tools.map(tool => (
                        <button
                          key={tool.id}
                          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-secondary/20 transition-all group gap-2.5"
                          onClick={() => tool.action ? tool.action() : handleAction(() => setActiveTool(tool))}
                        >
                          <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${tool.id === 'new' ? 'red-gradient text-white shadow-lg shadow-primary/20' : 'bg-surface/50 text-foreground/30 group-hover:text-secondary group-hover:bg-secondary/10 border border-white/5'}`}>
                            <tool.icon size={20} />
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
              {messages.length === 0 ? (
                /* Empty State / Welcome */
                <div className="h-full flex flex-col items-center justify-center p-8 min-h-[700px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center w-full max-w-2xl px-4"
                  >
                    <div className="w-16 h-16 red-gradient rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20 border border-white/5">
                      <Zap size={32} className="text-white fill-white" />
                    </div>
                    <h2 className="text-2xl font-black mb-2 tracking-tight uppercase">Welcome to the DocJockey Master.</h2>
                    <p className="text-foreground/60 text-sm mb-12 leading-relaxed max-w-sm mx-auto font-medium">
                      Navigate through your document workflows with agentic speed. Analyze, extract, and convert with ease.
                    </p>

                    {/* --- Upload Tabs --- */}
                    <div className="flex bg-surface/50 p-1.5 rounded-2xl border border-white/5 mb-8 max-w-md mx-auto">
                      <button 
                        onClick={() => { setUploadMode('single'); setAttachedFiles([]); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${uploadMode === 'single' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground/30 hover:text-white'}`}
                      >
                        <FileText size={14} /> Single document
                      </button>
                      <button 
                        onClick={() => { setUploadMode('multiple'); setAttachedFiles([]); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${uploadMode === 'multiple' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground/30 hover:text-white'}`}
                      >
                        <Layout size={14} /> Batch processor
                      </button>
                    </div>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full max-w-md border-2 border-dashed border-white/5 hover:border-primary/20 rounded-3xl p-14 cursor-pointer transition-all duration-500 group bg-surface/10 hover:bg-surface/20 mx-auto mb-8"
                    >
                      <div className="flex flex-col items-center gap-5">
                        <div className="w-20 h-20 bg-primary/5 text-primary rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform border border-primary/10 shadow-inner">
                          {uploadMode === 'single' ? <Paperclip size={40} /> : <Combine size={40} />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white mb-1 uppercase tracking-[0.2em]">
                            {uploadMode === 'single' ? 'Drop document' : 'Drop batch'}
                          </p>
                          <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em]">
                            Ready for DocJockey Speed
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* --- Welcome State Dialogue Box (Embedded) --- */}
                    <div className="max-w-xl mx-auto mb-12">
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
                       />
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto p-6 space-y-10">
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
              )}
            </div>
            <SiteFooter />
          </div>

          {/* Floating Input Area (Sticky Overlay - only when chat is active) */}
          <AnimatePresence>
            {messages.length > 0 && (
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="sticky bottom-0 p-6 md:p-8 shrink-0 bg-background/80 backdrop-blur-xl border-t border-white/5 z-40"
              >
                <div className="max-w-4xl mx-auto">
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
                   />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

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
  isEmbedded = false
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
          className="p-4 md:p-5 text-foreground/30 hover:text-white hover:bg-white/5 rounded-3xl transition-all shrink-0 border border-white/5 shadow-lg bg-surface/30"
        >
          <Paperclip size={24} />
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        </button>

        <div className="flex-1 bg-surface/50 border border-white/10 rounded-[2rem] focus-within:border-primary/40 transition-all overflow-hidden shadow-2xl">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEmbedded ? "Ask DocJockey to analyze or extract..." : "Send a message..."}
            rows={1}
            className="w-full bg-transparent px-6 py-5 text-sm outline-none resize-none placeholder:text-foreground/20 max-h-56 leading-relaxed font-medium"
            style={{ minHeight: '64px' }}
          />
        </div>

        <button
          onClick={sendMessage}
          disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
          className="p-5 md:p-6 red-gradient text-white rounded-[2rem] hover:brightness-110 transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed shrink-0 shadow-2xl shadow-primary/30 border border-white/10"
        >
          <Send size={24} />
        </button>
      </div>

      {!isEmbedded && (
        <div className="flex justify-center mt-6">
          <span className="text-[10px] text-foreground/10 font-black uppercase tracking-[0.5em] select-none">
            DocJockey Pro • Agentic Extraction • 2026
          </span>
        </div>
      )}
    </div>
  );
}
