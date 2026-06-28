import React, { useState, useRef, useEffect } from 'react';

const BACKEND_URL = "http://13.222.192.169:8000";

export default function App() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // App functional state
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const chatEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Auth submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (!email || !password || (authMode === 'signup' && !name)) {
      setAuthError('Please fill in all required fields.');
      return;
    }
    
    setAuthLoading(true);

    if (authMode === 'signup') {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
          setCurrentUser({ name, email });
          setIsLoggedIn(true);
          setMessages([
            {
              sender: "ai",
              text: `Welcome, ${name}! 👋 Your account has been registered in the MongoDB Atlas database. Upload a PDF document to build your knowledge base, and let's get started!`
            }
          ]);
        } else {
          setAuthError(data.error || 'Signup failed.');
        }
      } catch (err) {
        console.error(err);
        setAuthError('Network error connecting to MongoDB Auth Service.');
      } finally {
        setAuthLoading(false);
      }
    } else {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          setCurrentUser(data.user);
          setIsLoggedIn(true);
          setMessages([
            {
              sender: "ai",
              text: `Welcome back, ${data.user.name}! 👋 Let's pick up where we left off. Upload a PDF document to begin querying.`
            }
          ]);
        } else {
          setAuthError(data.error || 'Invalid credentials.');
        }
      } catch (err) {
        console.error(err);
        setAuthError('Network error connecting to MongoDB Auth Service.');
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setUploadStatus("");
      } else {
        setUploadStatus("❌ Only PDF files are supported.");
      }
    }
  };

  // Handle PDF file uploading
  const handleFileUpload = async (e) => {
    if (e) e.preventDefault();
    if (!file) {
      setUploadStatus("❌ Please select a PDF file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadStatus("⏳ Uploading and analyzing document...");

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus("✅ Document uploaded successfully!");
        setMessages((prev) => [
          ...prev,
          { 
            sender: "ai", 
            text: `📄 I have successfully processed "${file.name}". Ask me anything about it!` 
          }
        ]);
      } else {
        setUploadStatus(`❌ Error: ${data.detail || "Upload failed"}`);
      }
    } catch (err) {
      setUploadStatus("❌ Network error connecting to backend.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle asking questions
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
          aiResponse += `\n\n📚 Source references: ${uniqueSources.join(", ")}`;
        }
        
        setMessages((prev) => [...prev, { sender: "ai", text: aiResponse }]);
      } else {
        setMessages((prev) => [...prev, { sender: "ai", text: "❌ Failed to fetch response from the backend system." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "ai", text: "❌ Network error. Check your server connection." }]);
      console.error(err);
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  return (
    <div className="relative min-h-screen text-gray-100 flex flex-col font-sans overflow-x-hidden">
      {/* Dynamic Animated Background */}
      <div className="mesh-bg"></div>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      {/* Main Content Wrap */}
      <div className="relative z-10 flex-1 flex flex-col min-h-screen">
        
        {!isLoggedIn ? (
          /* ─── AUTH PAGE SCREEN ─────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 animate-fade-in gap-6">
            <div className="w-full max-w-[460px] glass-card p-8 md:p-10 flex flex-col gap-6">
              
              {/* Logo / Header */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="logo-ring">
                  <div className="logo-inner">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">
                  Algo<span className="gradient-text font-black">Docs</span>
                </h1>
                <p className="text-sm text-gray-400 max-w-[300px]">
                  Enterprise RAG & Cognitive Intelligence Workspace
                </p>
              </div>

              {/* Login / Sign Up Tabs */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                >
                  Create Account
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                {authMode === 'signup' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Kishor Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="auth-input"
                      required
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Password</label>
                    {authMode === 'login' && (
                      <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                    )}
                  </div>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input"
                    required
                  />
                </div>

                {authError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center gap-2">
                    <span>⚠️</span> {authError}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="auth-btn mt-2 flex items-center justify-center gap-2"
                >
                  {authLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    authMode === 'login' ? 'Access Workspace' : 'Register Account'
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ─── MAIN SYSTEM DASHBOARD ────────────────────────────── */
          <div className="flex-1 flex flex-col h-screen overflow-hidden animate-fade-in">
            
            {/* Top Premium Navbar */}
            <header className="bg-[#0b0f23]/60 backdrop-blur-md border-b border-white/5 py-4 px-6 shadow-lg">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h1 className="nav-logo-text text-white">
                    Algo<span className="gradient-text font-black">Docs</span>
                  </h1>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest hidden sm:inline-block">
                    RAG v1.2
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-400 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
                    👤 {currentUser?.name || 'Kishor'}
                  </div>
                  <button 
                    onClick={() => { setIsLoggedIn(false); setFile(null); setMessages([]); }}
                    className="text-xs bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 px-3 py-1.5 rounded-full transition-all"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

            {/* Main Interactive Layout split screen */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
              
              {/* Left Side: Upload Controls */}
              <section className="w-full lg:w-[350px] flex flex-col gap-5 flex-shrink-0">
                <div className="glass-card p-6 flex flex-col gap-5">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Document Upload
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload your PDF document to start chat.
                    </p>
                  </div>

                  <form onSubmit={handleFileUpload} className="flex flex-col gap-4">
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`drop-zone relative overflow-hidden transition-all ${
                        dragActive ? "border-indigo-400 bg-indigo-500/10" : ""
                      } ${file ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
                    >
                      <input 
                        type="file" 
                        id="pdf-upload"
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFile(e.target.files[0]);
                            setUploadStatus("");
                          }
                        }}
                        disabled={isUploading}
                      />
                      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center justify-center gap-3">
                        <div className={`p-3 rounded-xl transition-colors ${
                          file ? "bg-emerald-500/10 text-emerald-400" : "bg-indigo-500/10 text-indigo-400"
                        }`}>
                          {file ? (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-gray-200">
                            {file ? file.name : "Drag & drop PDF here"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "or click to select file"}
                          </span>
                        </div>
                      </label>
                    </div>

                    {file && (
                      <button
                        type="submit"
                        disabled={isUploading}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                          isUploading 
                            ? "bg-indigo-600/50 text-white/50 cursor-not-allowed" 
                            : "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20 active:scale-[0.98]"
                        }`}
                      >
                        {isUploading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Uploading Document...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Upload & Analyze Document
                          </>
                        )}
                      </button>
                    )}
                  </form>

                  {uploadStatus && (
                    <div className={`text-xs p-3 rounded-lg border leading-relaxed break-all ${
                      uploadStatus.includes("✅") 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        : uploadStatus.includes("❌")
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                        : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                    }`}>
                      {uploadStatus}
                    </div>
                  )}
                </div>
              </section>

              {/* Right Side: Chat Console */}
              <section className="flex-1 glass-card flex flex-col overflow-hidden min-h-[400px]">
                
                {/* Chat Panel Header */}
                <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Intelligence AI Assistant</h3>
                      <p className="text-[10px] text-gray-400">Ask questions about your uploaded documents</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMessages([{ sender: "ai", text: "Chat history cleared. How can I help you query your documents?" }])}
                    className="text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 transition-all"
                  >
                    Clear History
                  </button>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
                      <div className="p-4 rounded-full bg-white/5 text-gray-400 border border-white/5">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-300">RAG Workspace Ready</h4>
                      <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                        Upload a PDF database to index, then query the chatbot to extract intelligence instantly.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`flex gap-3 max-w-[85%] ${
                          msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          msg.sender === 'user' 
                            ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-300' 
                            : 'bg-white/5 border border-white/10 text-gray-300'
                        }`}>
                          {msg.sender === 'user' ? 'U' : 'AI'}
                        </div>
                        {/* Bubble */}
                        <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.sender === 'user' 
                            ? 'chat-bubble-user' 
                            : 'chat-bubble-ai shadow-md'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}

                  {isLoadingAnswer && (
                    <div className="flex gap-3 max-w-[85%] self-start">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                        AI
                      </div>
                      <div className="chat-bubble-ai px-4 py-3 text-sm flex items-center gap-3">
                        <div className="flex gap-1.5 items-center">
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                        </div>
                        <span className="text-xs text-gray-400">Querying hybrid vector engine...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input prompt bar */}
                <form onSubmit={handleAskQuestion} className="p-4 bg-white/[0.01] border-t border-white/5 flex gap-3 flex-shrink-0">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask an analytical question about the indexed document..."
                    disabled={isLoadingAnswer}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/5 placeholder-gray-500 disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingAnswer || !query.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/20 text-white px-5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span>Send</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </form>

              </section>

            </main>
          </div>
        )}

      </div>
    </div>
  );
}