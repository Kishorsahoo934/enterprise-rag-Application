import React, { useState, useRef, useEffect } from 'react';

// Change this to a relative path so the hosting platform handles the proxy translation
const BACKEND_URL = "/api";

export default function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle PDF file uploading via proxy path
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadStatus("❌ Please select a PDF file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadStatus("⏳ Extracting text and embedding vectors on AWS...");

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus("✅ Document successfully indexed into Vector Database!");
        setMessages([{ 
          sender: "ai", 
          text: `Hi Kishor! I have successfully processed "${file.name}". Ask me anything about it!` 
         }]);
      } else {
        setUploadStatus(`❌ Error: ${data.detail || "Upload failed"}`);
      }
    } catch (err) {
      setUploadStatus("❌ Network error connecting to AWS backend.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle asking questions via GET proxy path
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
          aiResponse += `\n\n📄 (Sources: ${uniqueSources.join(", ")})`;
        }
        
        setMessages((prev) => [...prev, { sender: "ai", text: aiResponse }]);
      } else {
        setMessages((prev) => [...prev, { sender: "ai", text: "❌ Failed to fetch an answer from the backend system." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "ai", text: "❌ Network error. Check your server connection." }]);
      console.error(err);
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-wide text-indigo-400">
            Enterprise RAG Terminal
          </h1>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            AWS Connected
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 flex flex-col md:flex-row gap-6 overflow-hidden">
        <section className="w-full md:w-1/3 bg-gray-800 p-5 rounded-xl border border-gray-700 h-fit flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">
            Document Setup
          </h2>
          <form onSubmit={handleFileUpload} className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-4 cursor-pointer hover:border-indigo-500 bg-gray-750 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <span className="text-sm text-gray-300 font-medium">
                {file ? file.name : "Select PDF Knowledge Base"}
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
              className={`w-full py-2.5 px-4 rounded-lg font-semibold shadow text-white transition-all ${
                isUploading 
                  ? "bg-indigo-700 opacity-50 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5"
              }`}
            >
              {isUploading ? "Processing Document..." : "Build Knowledge Index"}
            </button>
          </form>
          {uploadStatus && (
            <div className="text-xs bg-gray-850 p-3 rounded border border-gray-750 break-words leading-relaxed">
              {uploadStatus}
            </div>
          )}
        </section>

        <section className="flex-1 bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-[70vh] md:h-auto overflow-hidden">
          <div className="bg-gray-750 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-gray-200">Intelligence Agent Console</h3>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 space-y-1">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
                <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12" strokeWidth="2"></path></svg>
                Upload a document to ignite the semantic pipeline.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 whitespace-pre-wrap text-sm shadow leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-600 text-white self-end rounded-tr-none' 
                      : 'bg-gray-700 text-gray-100 self-start rounded-tl-none border border-gray-600'
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
            {isLoadingAnswer && (
              <div className="bg-gray-700 border border-gray-600 text-gray-400 self-start rounded-xl rounded-tl-none px-4 py-2.5 text-sm flex items-center gap-2 shadow">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </span>
                Querying FAISS + Groq Llama 3.3...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleAskQuestion} className="p-3 border-t border-gray-700 bg-gray-750 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask an analytical question..."
              disabled={isLoadingAnswer}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 placeholder-gray-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoadingAnswer || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}