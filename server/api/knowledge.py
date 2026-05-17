import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from core.rag.engine import RAGEngine

router = APIRouter()
rag_engine = RAGEngine()

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
KNOWLEDGE_BASE_DIR = Path(os.getenv("KNOWLEDGE_BASE_DIR", str(_PROJECT_ROOT / "data" / "knowledge-base")))


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    doc_id = file.filename or "unknown"
    rag_engine.index_document(doc_id, content, {"filename": doc_id})
    return {"status": "ok", "document": doc_id, "chunks": len(content) // 450 + 1}


@router.post("/index")
async def index_knowledge_base():
    if not KNOWLEDGE_BASE_DIR.exists():
        return {"status": "error", "message": "Knowledge base directory not found"}

    indexed = 0
    for f in KNOWLEDGE_BASE_DIR.glob("*.md"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        rag_engine.index_document(f.name, content, {"filename": f.name})
        indexed += 1
    for f in KNOWLEDGE_BASE_DIR.glob("*.txt"):
        content = f.read_text(encoding="utf-8", errors="ignore")
        rag_engine.index_document(f.name, content, {"filename": f.name})
        indexed += 1

    return {"status": "ok", "indexed_files": indexed}


@router.get("/status")
async def knowledge_status():
    try:
        info = rag_engine.get_status()
        return {"status": "ok", **info}
    except Exception as e:
        return {"status": "error", "message": str(e), "document_count": 0}
