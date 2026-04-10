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
  Moon
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
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || `OneStopDoc_${tool.id}.pdf`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <tool.icon size={24} />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-background rounded-full transition-colors">
            <X size={20} className="text-muted" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {files.length === 0 ? (
            <div
              onClick={() => document.getElementById('tool-file-input').click()}
              className="border-2 border-dashed border-border hover:border-primary/40 rounded-3xl p-12 cursor-pointer transition-all text-center group bg-background/30"
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
                  <p className="text-base font-bold text-foreground mb-1">
                    Select your {
                      tool.id.startsWith('pdf-to-') ? 'PDF or Image' : 
                      tool.id.startsWith('excel-to-') ? 'Excel' : 
                      tool.id.startsWith('word-to-') ? 'Word' : 'PDF'
                    } files
                  </p>
                  <p className="text-[11px] text-muted/60">Drag & drop or click to browser</p>
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
                  className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {files.length > 1 && (
                <p className="text-[10px] text-muted text-center italic">+ {files.length - 1} more files staged</p>
              )}
            </div>
          )}

          {files.length > 0 && tool.id === 'split' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">Page Ranges (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. 1-3, 5, 8-10"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/30 text-foreground"
              />
              <p className="text-[10px] text-muted/40 px-2 italic">Leave blank to split into individual pages.</p>
            </div>
          )}

          {files.length > 0 && tool.id === 'edit' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">Edit Instructions</label>
              <textarea 
                placeholder="e.g. Change the invoice date to 2024-12-01 and update the vendor name to ABC Corp"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/30 min-h-[100px] resize-none text-foreground"
              />
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
                <Settings size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary/80 leading-relaxed font-medium">
                  Smart Redraft generates a clean, standardized document based on your instructions. To preserve complex bank layouts or logos, use <span className="underline font-bold">Convert to Word</span> instead.
                </p>
              </div>
            </div>
          )}

          {files.length > 0 && tool.id === 'rotate' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">Rotation Angle</label>
              <div className="flex gap-4">
                {['90', '180', '270'].map(deg => (
                  <button 
                    key={deg} 
                    onClick={() => setDegrees(deg)}
                    className={`flex-1 py-3 rounded-2xl border transition-all text-sm font-medium ${
                      degrees === deg ? 'bg-primary/20 border-primary text-foreground' : 'bg-background border-border text-muted hover:border-primary/30'
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
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">Target Sheets (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. Sheet1, Sales, Data (Leave blank for all)"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/30 text-foreground"
              />
            </div>
          )}

          {files.length > 0 && tool.id === 'reorder' && (
            <div className="mt-8 space-y-3">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">New Page Sequence</label>
              <input 
                type="text"
                placeholder="e.g. 2, 1, 3"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/30 text-foreground"
              />
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
                   <Layout size={12} />
                   Ordering Guide:
                </div>
                <ul className="text-[10px] text-primary/80 space-y-1 ml-4 list-disc font-medium">
                  <li><strong>Reorder:</strong> List pages as <code className="bg-primary/10 px-1 rounded">2, 1, 3</code> to swap positions.</li>
                  <li><strong>Delete:</strong> Leave out a number (e.g. <code className="bg-primary/10 px-1 rounded">1, 3</code> deletes page 2).</li>
                  <li><strong>Duplicate:</strong> Repeat a number (e.g. <code className="bg-primary/10 px-1 rounded">1, 1, 2</code>).</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-background/50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-surface hover:bg-background transition-all border border-border">
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={isProcessing || files.length === 0}
            className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
function renderContent(text) {
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
            return <DynamicTable key={i} data={arr} raw={code} />;
          }
        } catch (e) { /* fall through to code block */ }
      }
      return (
        <pre key={i} className="bg-black/40 border border-white/5 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed">
          {code}
        </pre>
      );
    }

    // Regular text — simple markdown
    return (
      <div key={i} className={`prose prose-sm max-w-none ${document.documentElement.classList.contains('dark') ? 'prose-invert' : ''}`}>
        {part.split('\n').map((line, j) => {
          if (line.startsWith('### ')) return <h3 key={j} className="text-base font-bold text-foreground mt-4 mb-1">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={j} className="text-lg font-bold text-foreground mt-4 mb-1">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={j} className="text-xl font-bold text-foreground mt-4 mb-2">{line.replace('# ', '')}</h1>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="text-sm text-foreground/80 ml-4 list-disc">{line.replace(/^[-*] /, '')}</li>;
          if (line.startsWith('**') && line.endsWith('**')) return <p key={j} className="text-sm font-bold text-foreground">{line.replace(/\*\*/g, '')}</p>;
          if (line.trim() === '') return <br key={j} />;
          return <p key={j} className="text-sm text-foreground/80 leading-relaxed">{line}</p>;
        })}
      </div>
    );
  });
}

// ─── Dynamic Table (renders ANY JSON array) ──────────────
function DynamicTable({ data, raw }) {
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
    a.download = `nexgen_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(raw || JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
        <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={12} /> Structured Data • {data.length} rows
        </span>
        <div className="flex gap-2">
          <button onClick={copyJSON} className="view-btn">
            {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Copied' : 'JSON'}
          </button>
          <button onClick={() => window.open(`${API}/conversations/${activeConvId}/export?format=xlsx`, '_blank')} className="view-btn text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">
            <FileSpreadsheet size={10} /> Excel (.xlsx)
          </button>
          <button onClick={() => window.open(`${API}/conversations/${activeConvId}/export?format=docx`, '_blank')} className="view-btn text-blue-400 border-blue-500/20 hover:bg-blue-500/10">
            <FileType size={10} /> Word (.docx)
          </button>
          <button onClick={downloadCSV} className="view-btn">
            <Download size={10} /> CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-surface/80 text-muted uppercase tracking-wider font-bold">
              {headers.map(h => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-background/50 transition-colors">
                {headers.map(h => (
                  <td key={h} className="px-4 py-3 text-foreground/80 whitespace-nowrap max-w-[250px] truncate">
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
        isUser ? 'bg-primary/20 text-primary' : 'bg-surface border border-border text-foreground'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((name, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-medium">
                <FileText size={10} /> {name}
              </span>
            ))}
          </div>
        )}
        <div className={`rounded-2xl px-5 py-4 ${
          isUser ? 'bg-primary/15 border border-primary/20 text-foreground' : 'bg-surface border border-border text-foreground'
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div>{renderContent(msg.content)}</div>
          )}
        </div>
        <p className="text-[10px] text-muted/40 mt-1.5 px-2">
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
  const [theme, setTheme] = useState(localStorage.getItem('onestop_theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('onestop_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const chatContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState(null);
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'multiple'
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* ─── Sidebar ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-border flex flex-col bg-surface/50 backdrop-blur-xl shrink-0 overflow-hidden"
          >
            <div className="p-5 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-sky-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                  <Zap size={18} className="text-white fill-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight">OneStopDoc</h1>
              </div>
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-surface rounded-lg text-muted transition-all"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-bold text-primary hover:bg-primary hover:text-white transition-all"
              >
                <Plus size={16} /> New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-6 py-2">
              {/* --- Intelligence --- */}
              <div>
                <p className="px-3 text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">Intelligence</p>
                <div className="space-y-1">
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between group transition-all ${
                        activeConvId === conv.id ? 'bg-primary/15 text-white border border-primary/20' : 'text-muted hover:bg-surface hover:text-white'
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
                  {conversations.length === 0 && (
                    <p className="px-4 py-2 text-[10px] text-muted/30 italic">No recent chats</p>
                  )}
                </div>
              </div>

              {/* --- File Manipulation --- */}
              <div>
                <p className="px-3 text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">File Manipulation</p>
                <div className="space-y-1">
                  {[
                    { id: 'merge', icon: Combine, label: 'Merge PDF' },
                    { id: 'split', icon: Scissors, label: 'Split PDF' },
                    { id: 'compress', icon: Minimize2, label: 'Compress PDF' },
                    { id: 'repair', icon: Eraser, label: 'Repair PDF' },
                  ].map(tool => (
                    <button key={tool.label} className="tool-btn" onClick={() => setActiveTool(tool)}>
                      <tool.icon size={14} /> {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- Conversion --- */}
              <div>
                <p className="px-3 text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">Conversion</p>
                <div className="space-y-1">
                  {[
                    { id: 'pdf-to-word', icon: FileType, label: 'PDF to Word' },
                    { id: 'pdf-to-excel', icon: FileSpreadsheet, label: 'PDF to Excel' },
                    { id: 'excel-to-pdf', icon: ArrowRightLeft, label: 'Excel to PDF' },
                    { id: 'word-to-pdf', icon: FileText, label: 'Word to PDF' },
                  ].map(tool => (
                    <button key={tool.id} className="tool-btn" onClick={() => setActiveTool(tool)}>
                      <tool.icon size={14} /> {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- Core Editing --- */}
              <div>
                <p className="px-3 text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">Core Editing</p>
                <div className="space-y-1">
                  {[
                    { id: 'edit', icon: Type, label: 'A.I. Smart Redraft' },
                  ].map(tool => (
                    <button key={tool.id} className="tool-btn" onClick={() => setActiveTool(tool)}>
                      <tool.icon size={14} /> {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- Page Organization --- */}
              <div>
                <p className="px-3 text-[10px] font-bold text-muted/50 uppercase tracking-widest mb-2">Page Organization</p>
                <div className="space-y-1">
                  {[
                    { id: 'rotate', icon: RotateCw, label: 'Rotate Pages' },
                    { id: 'reorder', icon: Layout, label: 'Organize Pages' },
                  ].map(tool => (
                    <button key={tool.id} className="tool-btn" onClick={() => setActiveTool(tool)}>
                      <tool.icon size={14} /> {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5">
              <div className="bg-gradient-to-br from-primary/10 to-sky-500/10 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Free Trial</p>
                <p className="text-[10px] text-muted">3 free chats remaining</p>
                <div className="w-full h-1 bg-surface rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary w-[100%] rounded-full" />
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Main Chat Area ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between bg-background/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-surface rounded-lg transition-colors text-muted hover:text-white">
              <ChevronDown size={16} className={`transform transition-transform ${sidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <span className="text-sm font-medium text-muted">
              {activeConvId ? conversations.find(c => c.id === activeConvId)?.title || 'Chat' : 'New Chat'}
            </span>
          </div>
          <span className="text-[10px] text-muted/50 font-mono uppercase tracking-widest">Gemini 2.5 Pro</span>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {messages.length === 0 ? (
            /* Empty State / Welcome */
            <div className="h-full flex flex-col items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-lg"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
                  <Zap size={32} className="text-white fill-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">What do you need from your documents?</h2>
                <p className="text-muted text-sm mb-8 leading-relaxed">
                  Analyze documents, extract tabular data, or convert files with NexGen Intelligence.
                </p>

                {/* --- Upload Tabs --- */}
                <div className="flex bg-surface/50 p-1 rounded-2xl border border-white/5 mb-6">
                  <button 
                    onClick={() => { setUploadMode('single'); setAttachedFiles([]); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${uploadMode === 'single' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-white'}`}
                  >
                    <FileText size={14} /> Single Document
                  </button>
                  <button 
                    onClick={() => { setUploadMode('multiple'); setAttachedFiles([]); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${uploadMode === 'multiple' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-white'}`}
                  >
                    <Layout size={14} /> Batch Processor
                  </button>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                    const dropped = Array.from(e.dataTransfer.files).filter(f => {
                      const ext = f.name.toLowerCase().split('.').pop();
                      return ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'png', 'jpg', 'jpeg'].includes(ext);
                    });
                    
                    if (uploadMode === 'single') {
                      if (dropped.length > 0) setAttachedFiles([dropped[0]]);
                    } else {
                      setAttachedFiles(prev => [...prev, ...dropped]);
                    }
                  }}
                  className="w-full max-w-md border-2 border-dashed border-white/10 hover:border-primary/40 rounded-3xl p-12 cursor-pointer transition-all duration-300 group bg-surface/20"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {uploadMode === 'single' ? <Paperclip size={32} /> : <Combine size={32} />}
                    </div>
                    <div>
                      <p className="text-base font-bold text-white mb-1">
                        {uploadMode === 'single' ? 'Drop your file here' : 'Drop multiple files here'}
                      </p>
                      <p className="text-[11px] text-muted/60">
                        {uploadMode === 'single' ? 'Supports PDF, Word, Excel, or Images' : 'Process up to 10 documents at once'}
                      </p>
                    </div>
                    {attachedFiles.length > 0 && (
                      <div className="mt-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                        <p className="text-[10px] font-bold text-primary italic">
                          {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} staged for analysis
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} />
              ))}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-surface border border-white/10 flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="bg-surface/50 border border-white/5 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Analyzing your document...
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-white/5 p-4 bg-background/80 backdrop-blur-md shrink-0">
          <div className="max-w-5xl mx-auto">
            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachedFiles.map((file, i) => (
                  <span key={i} className="flex items-center gap-2 text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg">
                    <FileText size={12} />
                    {file.name}
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-white">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3">
              {/* File Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-all shrink-0"
              >
                <Paperclip size={20} />
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-input"
                  multiple
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                />
              </button>

              {/* Text Input */}
              <div className="flex-1 bg-surface/50 border border-white/10 rounded-2xl focus-within:border-primary/50 transition-all overflow-hidden">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your documents..."
                  rows={1}
                  className="w-full bg-transparent px-5 py-3.5 text-sm outline-none resize-none placeholder:text-muted/70 max-h-32"
                  style={{ minHeight: '48px' }}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
                className="p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-primary/20"
              >
                <Send size={20} />
              </button>
            </div>

            <p className="text-[10px] text-muted/60 text-center mt-3">
              OneStopDoc can make mistakes. Verify important data.
            </p>
          </div>
        </div>
      </main>

      {activeTool && <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} />}
    </div>
  );
}
