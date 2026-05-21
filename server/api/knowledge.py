import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends
from core.rag.engine import RAGEngine
from core.auth import get_current_user
from db.models import User

router = APIRouter()
rag_engine = RAGEngine()

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
KNOWLEDGE_BASE_DIR = Path(os.getenv("KNOWLEDGE_BASE_DIR", str(_PROJECT_ROOT / "data" / "knowledge-base")))


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    doc_id = file.filename or "unknown"
    rag_engine.index_document(doc_id, content, {"filename": doc_id})
    return {"status": "ok", "document": doc_id, "chunks": len(content) // 450 + 1}


@router.post("/index")
async def index_knowledge_base(current_user: User = Depends(get_current_user)):
    if not KNOWLEDGE_BASE_DIR.exists():
        return {"status": "error", "message": "Knowledge base directory not found"}

    indexed = 0
    total_chunks = 0
    files = []
    for f in sorted(KNOWLEDGE_BASE_DIR.glob("*.md")):
        content = f.read_text(encoding="utf-8", errors="ignore")
        chunks = rag_engine.index_document_with_count(f.name, content, {"filename": f.name})
        indexed += 1
        total_chunks += chunks
        files.append(f.name)
    for f in sorted(KNOWLEDGE_BASE_DIR.glob("*.txt")):
        content = f.read_text(encoding="utf-8", errors="ignore")
        chunks = rag_engine.index_document_with_count(f.name, content, {"filename": f.name})
        indexed += 1
        total_chunks += chunks
        files.append(f.name)

    return {"status": "ok", "indexed": indexed, "total_chunks": total_chunks, "files": files}


@router.post("/reindex")
async def reindex_knowledge_base(current_user: User = Depends(get_current_user)):
    rag_engine.clear_collection()
    return await index_knowledge_base()


@router.get("/status")
async def knowledge_status(current_user: User = Depends(get_current_user)):
    try:
        info = rag_engine.get_status()
        return {"status": "ok", **info}
    except Exception as e:
        return {"status": "error", "message": str(e), "document_count": 0}
