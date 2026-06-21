# 🚀 Enterprise Hybrid RAG Terminal

An advanced, production-ready **Hybrid Retrieval-Augmented Generation (RAG)** system built to process dense structural and sparse contextual intelligence from enterprise data. The architecture implements an asymmetric search framework combining semantic vector space retrieval with localized keyword relevance models, deployed seamlessly within an isolated container ecosystem on AWS EC2.

---

## 💡 Core Architecture

The pipeline uses a multi-layered hybrid ingestion and retrieval workflow to extract domain knowledge from complex data layouts:

* **Dual-Engine Ingestion Pipeline:** Intelligently runs standard structural token layouts (`PyPDFLoader`) or switches directly to computer vision layouts (`EasyOCR` via `pdf2image`) if a scanned or flattened document matrix is detected.
* **Asymmetric Hybrid Search Core:** Executes a combined sparse keyword retrieval pass (**BM25 Okapi**) and dense semantic vector computation (**FAISS** mapped with `all-MiniLM-L6-v2` embeddings). This captures deep conceptual relationships alongside strict terminal syntax matches.
* **Contextual Reranking & Synthesis:** Merges text intersections and feeds isolated high-priority chunks to **Llama 3.3 (via Groq Inference Engine)** under zero-shot validation guardrails.

---

## 🛠️ Technical Stack

* **Frontend Interface:** React (Vite), Tailwind CSS, React Hooks (`useRef`, `useEffect`)
* **Backend Server:** FastAPI, Uvicorn, Pydantic Engine
* **AI & RAG Frameworks:** LangChain, FAISS Vector DB, Rank-BM25, HuggingFace Transformers
* **Vision & Extraction:** EasyOCR, Poppler-Utils, PyPDF
* **Deployment Suite:** Docker, AWS EC2, Linux Environment

---

## 🚀 Installation & Local Environment Setup

### 1. System Pre-requisites
Ensure your host machine has Docker installed and running. If running locally on Windows and testing OCR fallbacks, ensure the Poppler binary directory is configured correctly.

### 2. Configure Environment Secrets
Create a `.env` file in the root backend directory:
```env
GROQ_API_KEY=your_groq_api_key_here
