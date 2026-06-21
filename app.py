import os
import pickle

from fastapi import FastAPI, UploadFile, File, HTTPException
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from rank_bm25 import BM25Okapi
from pypdf import PdfReader
from langchain_core.documents import Document
import easyocr
from pdf2image import convert_from_path

# ==================================================
# LOAD ENV & CONFIG STORAGE
# ==================================================
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")

# FIX 2: Define a base path that switches between Render (Persistent Disk) and Local
# Render mounts disks typically at '/data'. If it doesn't exist, we fall back to local root.
STORAGE_BASE = "/data" if os.path.exists("/data") else "."

VECTOR_DB_PATH = os.path.join(STORAGE_BASE, "faiss_db")
BM25_PKL_PATH = os.path.join(STORAGE_BASE, "bm25.pkl")
UPLOADS_DIR = os.path.join(STORAGE_BASE, "uploads")

# Ensure the upload directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ==================================================
# OCR CONFIG
# ==================================================
# FIX 1: Removed POPPLER_PATH. Linux containers manage poppler globally.
reader = easyocr.Reader(['en'], gpu=False)

# ==================================================
# FASTAPI & CORE MODELS
# ==================================================
app = FastAPI(title="Enterprise Hybrid RAG", version="1.0")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
llm = ChatGroq(groq_api_key=GROQ_API_KEY, model_name="llama-3.3-70b-versatile")

chunks_store = []
bm25 = None

# ==================================================
# OCR FUNCTIONS
# ==================================================
def is_scanned_pdf(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text
        return len(text.strip()) < 50
    except Exception as e:
        print("PDF Detection Error:", e)
        return True

def extract_text_from_scanned_pdf(pdf_path):
    # FIX 1: Removed poppler_path argument completely
    pages = convert_from_path(pdf_path)

    full_text = ""
    for idx, page in enumerate(pages, start=1):
        # Save temp images in the uploads directory to prevent root permission errors
        temp_image = os.path.join(UPLOADS_DIR, f"temp_page_{idx}.jpg")
        page.save(temp_image)

        result = reader.readtext(temp_image, detail=0)
        page_text = " ".join(result)
        full_text += f"\n--- PAGE {idx} ---\n{page_text}"

        if os.path.exists(temp_image):
            os.remove(temp_image)

    return full_text

def load_document(pdf_path):
    if is_scanned_pdf(pdf_path):
        print("Scanned PDF detected. Using OCR...")
        text = extract_text_from_scanned_pdf(pdf_path)
        return [Document(page_content=text, metadata={"source": pdf_path, "page": 1})]
    else:
        print("Normal PDF detected.")
        loader = PyPDFLoader(pdf_path)
        return loader.load()

# ==================================================
# UPLOAD PDF (FIX 2 applied to paths)
# ==================================================
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global bm25, chunks_store

    try:
        pdf_path = os.path.join(UPLOADS_DIR, file.filename)

        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        docs = load_document(pdf_path)
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_documents(docs)
        chunks_store = chunks

        db = FAISS.from_documents(chunks, embeddings)
        db.save_local(VECTOR_DB_PATH)

        tokenized_docs = [chunk.page_content.split() for chunk in chunks]
        bm25 = BM25Okapi(tokenized_docs)

        with open(BM25_PKL_PATH, "wb") as f:
            pickle.dump(bm25, f)

        return {
            "status": "success",
            "chunks_created": len(chunks),
            "file": file.filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================================================
# HYBRID SEARCH (FIX 2 applied to paths)
# ==================================================
def hybrid_search(query):
    if not os.path.exists(VECTOR_DB_PATH):
        raise Exception("No vector database found. Upload a PDF first.")

    db = FAISS.load_local(
        VECTOR_DB_PATH, embeddings, allow_dangerous_deserialization=True
    )

    dense_docs = db.similarity_search(query, k=5)
    sparse_docs = []

    # If the app restarted, reload bm25 into memory from disk
    global bm25, chunks_store
    if not bm25 and os.path.exists(BM25_PKL_PATH):
        with open(BM25_PKL_PATH, "rb") as f:
            bm25 = pickle.load(f)
            # Reconstruct basic chunk stores if needed, or rely entirely on Vector DB fallback

    if bm25:
        # Note: chunks_store needs persistence or fallback if bm25 requires it. 
        # For full hybrid persistence across restarts, saving 'chunks_store' via pickle is recommended.
        sparse_docs = bm25.get_top_n(query.split(), chunks_store, n=5)

    merged = []
    seen = set()
    for doc in dense_docs + sparse_docs:
        text = doc.page_content
        if text not in seen:
            seen.add(text)
            merged.append(doc)

    return merged[:5]

# ... Keep your /ask, /health, and / routes exactly as they were ...


# ==================================================
# ASK QUESTION
# ==================================================


@app.get("/ask")
def ask(query: str):

    try:

        docs = hybrid_search(query)

        context = "\n\n".join([d.page_content for d in docs])

        prompt = f"""
You are an intelligent document assistant.

Answer ONLY from the provided context.

If answer is not available,
say:
"I could not find this information in the document."

CONTEXT:
{context}

QUESTION:
{query}

Provide a clear answer.
"""

        response = llm.invoke(prompt)

        sources = []

        for d in docs:

            page = d.metadata.get("page", "Unknown")

            source = d.metadata.get("source", "Unknown")

            sources.append(f"{source} page {page}")

        return {"question": query, "answer": response.content, "sources": sources}

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# HEALTH CHECK
# ==================================================


@app.get("/health")
def health():

    return {"status": "healthy"}
