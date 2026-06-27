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
import os
# ==================================================
# LOAD ENV
# ==================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env")

# ==================================================
# OCR CONFIG
# ==================================================
POPPLER_PATH = r"K:\Release-26.02.0-0\poppler-26.02.0\Library\bin"
reader = easyocr.Reader(
    ['en'],
    gpu=False
)
# ==================================================
# FASTAPI
# ==================================================

app = FastAPI(title="Enterprise Hybrid RAG", version="1.0")

# ==================================================
# VECTOR STORE
# ==================================================

VECTOR_DB_PATH = "faiss_db"

# ==================================================
# EMBEDDINGS
# ==================================================

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# ==================================================
# GROQ LLM
# ==================================================

llm = ChatGroq(groq_api_key=GROQ_API_KEY, model_name="llama-3.3-70b-versatile")

# ==================================================
# GLOBAL VARIABLES
# ==================================================

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

    pages = convert_from_path(
        pdf_path,
        poppler_path=POPPLER_PATH
    )

    full_text = ""

    for idx, page in enumerate(pages, start=1):

        temp_image = f"temp_page_{idx}.jpg"

        page.save(temp_image)

        result = reader.readtext(
            temp_image,
            detail=0
        )

        page_text = " ".join(result)

        full_text += f"\n--- PAGE {idx} ---\n"

        full_text += page_text

        if os.path.exists(temp_image):
            os.remove(temp_image)

    print("\n===== OCR OUTPUT =====")
    print(full_text)
    print("======================")

    return full_text


def load_document(pdf_path):

    if is_scanned_pdf(pdf_path):

        print("Scanned PDF detected. Using OCR...")

        text = extract_text_from_scanned_pdf(pdf_path)

        docs = [Document(page_content=text, metadata={"source": pdf_path, "page": 1})]

        return docs

    else:

        print("Normal PDF detected.")

        loader = PyPDFLoader(pdf_path)

        return loader.load()


# ==================================================
# ROOT
# ==================================================


@app.get("/")
def home():

    return {"message": "Enterprise Hybrid RAG Running"}


# ==================================================
# UPLOAD PDF
# ==================================================


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    global bm25
    global chunks_store

    try:

        os.makedirs("uploads", exist_ok=True)

        pdf_path = os.path.join("uploads", file.filename)

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

        with open("bm25.pkl", "wb") as f:
            pickle.dump(bm25, f)

        return {
            "status": "success",
            "chunks_created": len(chunks),
            "file": file.filename,
        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# HYBRID SEARCH
# ==================================================


def hybrid_search(query):

    if not os.path.exists(VECTOR_DB_PATH):

        raise Exception("No vector database found. Upload a PDF first.")

    db = FAISS.load_local(
        VECTOR_DB_PATH, embeddings, allow_dangerous_deserialization=True
    )

    dense_docs = db.similarity_search(query, k=5)

    sparse_docs = []

    if bm25:

        sparse_docs = bm25.get_top_n(query.split(), chunks_store, n=5)

    merged = []

    seen = set()

    for doc in dense_docs + sparse_docs:

        text = doc.page_content

        if text not in seen:

            seen.add(text)

            merged.append(doc)

    return merged[:5]


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
