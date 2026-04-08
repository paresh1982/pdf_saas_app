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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = 'http://localhost:5000/api';

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
      <div key={i} className="prose prose-invert prose-sm max-w-none">
        {part.split('\n').map((line, j) => {
          if (line.startsWith('### ')) return <h3 key={j} className="text-base font-bold text-white mt-4 mb-1">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={j} className="text-lg font-bold text-white mt-4 mb-1">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={j} className="text-xl font-bold text-white mt-4 mb-2">{line.replace('# ', '')}</h1>;
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} className="text-sm text-neutral-200 ml-4 list-disc">{line.replace(/^[-*] /, '')}</li>;
          if (line.startsWith('**') && line.endsWith('**')) return <p key={j} className="text-sm font-bold text-white">{line.replace(/\*\*/g, '')}</p>;
          if (line.trim() === '') return <br key={j} />;
          return <p key={j} className="text-sm text-neutral-200 leading-relaxed">{line}</p>;
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
    <div className="my-4 bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={12} /> Structured Data • {data.length} rows
        </span>
        <div className="flex gap-2">
          <button onClick={copyJSON} className="text-[10px] text-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-all">
            {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Copied' : 'JSON'}
          </button>
          <button onClick={downloadCSV} className="text-[10px] text-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-all">
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
          <tbody className="divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                {headers.map(h => (
                  <td key={h} className="px-4 py-3 text-neutral-200 whitespace-nowrap max-w-[250px] truncate">
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
        isUser ? 'bg-primary/20 text-primary' : 'bg-surface border border-white/10 text-white'
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
          isUser ? 'bg-primary/15 border border-primary/20 text-white' : 'bg-surface/50 border border-white/5 text-white'
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
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <div className="flex h-screen bg-background text-white font-sans selection:bg-primary/30">
      {/* ─── Sidebar ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-xl shrink-0 overflow-hidden"
          >
            <div className="p-5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-sky-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                  <Zap size={18} className="text-white fill-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight">OneStopDoc</h1>
              </div>
            </div>

            <div className="p-3">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm font-bold text-primary hover:bg-primary hover:text-white transition-all"
              >
                <Plus size={16} /> New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all ${
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
                  Upload any PDF — invoices, contracts, white papers, lab reports — and tell me what you need.
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
                    if (files.length) setAttachedFiles(prev => [...prev, ...files]);
                  }}
                  className="w-full max-w-md border-2 border-dashed border-white/10 hover:border-primary/40 rounded-2xl p-10 cursor-pointer transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Paperclip size={28} />
                    </div>
                    <p className="text-sm font-medium text-white">Drop PDFs here or click to upload</p>
                    <p className="text-[11px] text-muted/80">Supports multiple files • Max 20MB each</p>
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
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

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
    </div>
  );
}
