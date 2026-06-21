import React, { useState, useRef, useEffect } from 'react';

// Production reverse-proxy abstraction path
const BACKEND_URL = "/api";

export default function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  
  const chatEndRef = useRef(null);

  // Auto-scroll management
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Document Ingestion Handler
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadStatus("❌ System Alert: Target file object required for ingestion initialization.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadStatus("⏳ Pipeline Initialized: Extracting token vectors and mounting structural indices...");

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus("✅ Success: Knowledge matrix mapped and synchronized with Vector DB.");
        setMessages([{ 
          sender: "ai", 
          text: `Data pipeline successfully established for workspace: "${file.name}". Dynamic context window is ready for execution mapping.` 
        }]);
      } else {
        setUploadStatus(`❌ Pipeline Fault: ${data.detail || "Ingestion sequence terminated."}`);
      }
    } catch (err) {
      setUploadStatus("❌ Network Exception: Routing failure through secure ingress gateway.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Hybrid Search Execution Loop
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = query;
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);
    setQuery("");
    setIsLoadingAnswer(true);

    try {
      const url = `${BACKEND_URL}/ask?query=${encodeURIComponent(userMessage)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        let aiResponse = data.answer;
        
        if (data.sources && data.sources.length > 0) {
          const cleanedSources = data.sources.map(src => {
            let cleanStr = src.replace(/^\.\/uploads\/|^uploads\//i, "");
            if (cleanStr.includes("page 0")) {
              cleanStr = cleanStr.replace("page 0", "Page 1");
            } else {
              cleanStr = cleanStr.replace(/page (\d+)/i, (match, p1) => `Page ${parseInt(p1) + 1}`);
            }
            return cleanStr;
          });

          const uniqueSources = [...new Set(cleanedSources)];
          aiResponse += `\n\n📄 [Context Validation: ${uniqueSources.join(", ")}]`;
        }
        
        setMessages((prev) => [...prev, { sender: "ai", text: aiResponse }]);
      } else {
        setMessages((prev) => [...prev, { sender: "ai", text: "❌ Analytics Error: Prompt synthesis blocked by node execution failure." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "ai", text: "❌ Gateway Exception: Connection broken during query handshake." }]);
      console.error(err);
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Sleek Enterprise Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 shadow-sm backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-200">
              Cognitive Insight Engine <span className="text-xs font-mono font-medium px-2 py-0.5 ml-2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">v1.1.0</span>
            </h1>
          </div>
          <div className="text-xs font-mono font-medium text-slate-400 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            Cloud Gateway: Operational
          </div>
        </div>
      </header>

      {/* Modern Main Workspace Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* Left Control Column: Knowledge Ingestion Panel */}
        <section className="w-full md:w-80 bg-slate-900 p-5 rounded-xl border border-slate-800 h-fit flex flex-col gap-5 shadow-xl">
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">
              Knowledge Ingestion
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Mount source materials to seed the distributed semantic index.
            </p>
          </div>

          <form onSubmit={handleFileUpload} className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all group">
              <svg className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span className="text-xs text-slate-400 group-hover:text-slate-200 text-center truncate max-w-full font-medium">
                {file ? file.name : "Select Source Document (PDF)"}
              </span>
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files[0])}
                disabled={isUploading}
              />
            </label>
            <button
              type="submit"
              disabled={isUploading}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold shadow-sm text-white tracking-wide transition-all ${
                isUploading 
                  ? "bg-indigo-700 opacity-50 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]"
              }`}
            >
              {isUploading ? "Syncing Vector Maps..." : "Execute Matrix Ingestion"}
            </button>
          </form>

          {uploadStatus && (
            <div className="text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 break-words text-slate-400 leading-relaxed">
              {uploadStatus}
            </div>
          )}
        </section>

        {/* Right Control Column: Operational Console Panel */}
        <section className="flex-1 bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[65vh] md:h-auto overflow-hidden shadow-xl">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400">Contextual Query Console</h3>
            <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-500">
              Llama-3.3 // FAISS Hybrid Optimized
            </span>
          </div>

          {/* Core Chat Output Loop */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
                <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                Console inactive. Complete data ingestion mapping to start telemetry searches.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`max-w-[85%] rounded-xl px-4 py-3 whitespace-pre-wrap text-xs shadow-sm leading-relaxed tracking-wide ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-600 text-white self-end rounded-tr-none' 
                      : 'bg-slate-950 text-slate-300 self-start rounded-tl-none border border-slate-800'
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
            {isLoadingAnswer && (
              <div className="bg-slate-950 border border-slate-800 text-slate-500 self-start rounded-xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-2.5 shadow-sm">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce"></span>
                  <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
                Cross-referencing BM25 / Vector matrices...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Secure Input Dock */}
          <form onSubmit={handleAskQuestion} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Submit transactional pipeline query..."
              disabled={isLoadingAnswer}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoadingAnswer || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-lg text-xs font-semibold tracking-wide transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Execute
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}