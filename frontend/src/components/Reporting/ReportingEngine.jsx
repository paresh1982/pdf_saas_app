import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileDown, 
  Printer, 
  X, 
  ShieldCheck, 
  Sparkles,
  Loader2
} from 'lucide-react';

const API = '/api';

export default function ReportingEngine({ activeConvId, isMobile, type = 'trigger' }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!activeConvId) {
        alert("Please ensure a conversation is active.");
        return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const { data } = await axios.post(`${API}/generate-reporting-executive`, {
        conversation_id: activeConvId
      });
      setReportData(data);
    } catch (err) {
      console.error('Reporting error:', err);
      setError(err.response?.data?.details || err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadHTML = () => {
    if (!reportData?.html) return;
    const blob = new Blob([reportData.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DocJockey_Executive_Report_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- UI PART 1: The Trigger Bar ---
  if (type === 'trigger') {
    return (
      <>
        <div className="w-full flex items-center gap-4 py-4 px-2 select-none">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">OR</span>
             <button
               onClick={handleGenerate}
               disabled={isGenerating || !activeConvId}
               className={`
                 group relative flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all 
                 ${isGenerating 
                   ? 'bg-white/5 text-foreground/40 cursor-wait' 
                   : 'bg-secondary/10 text-secondary hover:bg-secondary hover:text-white shadow-lg shadow-secondary/5 border border-secondary/20'
                 }
                 disabled:opacity-20 disabled:grayscale
               `}
             >
               {isGenerating ? (
                 <Loader2 size={14} className="animate-spin" />
               ) : (
                 <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
               )}
               {isGenerating ? 'Synthesizing...' : 'Generate Executive Report'}
             </button>
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* --- Global Portal Overlay --- */}
        <AnimatePresence>
          {reportData && (
            <ReportPortal 
              data={reportData} 
              onClose={() => setReportData(null)} 
              onDownload={handleDownloadHTML} 
            />
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 bg-red-500 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-4"
            >
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="hover:rotate-90 transition-transform"><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
}

// --- UI PART 2: The Portal Overlay ---
function ReportPortal({ data, onClose, onDownload }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-background/95 backdrop-blur-2xl flex flex-col overflow-hidden"
    >
      {/* Header Bar */}
      <div className="h-20 shrink-0 border-b border-white/5 flex items-center justify-between px-6 md:px-12 bg-white/2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-white shadow-xl shadow-secondary/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Audit Portal</h2>
            <p className="text-[10px] text-secondary font-black uppercase tracking-[0.2em] mt-1 opacity-80">Phase 2: Executive Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => window.print()}
            className="p-3 text-foreground/40 hover:text-white transition-all hover:bg-white/5 rounded-xl hidden md:block"
          >
            <Printer size={20} />
          </button>
          
          <button
            onClick={onDownload}
            className="px-6 py-3 bg-secondary text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-secondary/20 hover:brightness-110 transition-all flex items-center gap-3"
          >
            <FileDown size={14} />
            <span className="hidden md:inline">Download HTML</span>
          </button>

          <div className="w-px h-8 bg-white/10 mx-2 hidden md:block" />

          <button
            onClick={onClose}
            className="p-3 text-foreground/40 hover:text-white transition-all hover:bg-white/5 rounded-xl"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Content (IFRAME for style isolation) */}
      <div className="flex-1 p-4 md:p-12 overflow-hidden bg-black/20">
        <div className="max-w-5xl mx-auto w-full h-full bg-white rounded-2xl shadow-inner-xl overflow-hidden animate-in fade-in zoom-in duration-500 border border-white/5">
          <iframe 
            srcDoc={data.html}
            title="Executive Report Preview"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </motion.div>
  );
}
