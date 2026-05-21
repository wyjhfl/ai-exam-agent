import os
import logging
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import User
from core.auth import get_current_user
from core.document_processor import DocumentProcessor
from core.rag.engine import RAGEngine
import aiofiles

logger = logging.getLogger(__name__)
router = APIRouter()
rag_engine = RAGEngine()


def _get_limiter():
    from main import limiter
    return limiter


_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(_PROJECT_ROOT / "data" / "uploads")))
MAX_UPLOAD_SIZE = 50 * 1024 * 1024


def safe_file_path(user_dir: Path, file_id: str) -> Path:
    if ".." in file_id or "/" in file_id or "\\" in file_id:
        raise HTTPException(status_code=400, detail="无效的文件 ID")
    path = (user_dir / file_id).resolve()
    if not str(path).startswith(str(user_dir.resolve())):
        raise HTTPException(status_code=400, detail="路径越界")
    return path


@router.post("/upload")
async def upload_file(
    http_request: Request,
    subject: str = Form("数学"),
    file_type: str = Form("教辅资料"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    allowed_ext = {".pdf", ".docx", ".doc", ".txt", ".md"}
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}，支持: {', '.join(allowed_ext)}")

    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_name = f"{timestamp}_{filename}"
    file_path = user_dir / safe_name

    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="文件过大，限制 50MB")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    try:
        text = DocumentProcessor.process_file(str(file_path))
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"文件解析失败: {str(e)}")

    chunks = DocumentProcessor.chunk_text(text)
    pages = text.count("\n\n") + 1

    metadata = {
        "user_id": user_id,
        "subject": subject,
        "file_type": file_type,
        "filename": filename,
        "safe_name": safe_name,
        "upload_time": timestamp,
    }
    doc_id = f"user_{user_id}_{safe_name}"
    rag_engine.index_document(doc_id, text, metadata)

    return {
        "file_id": safe_name,
        "filename": filename,
        "subject": subject,
        "file_type": file_type,
        "pages": pages,
        "chunks": len(chunks),
        "size": len(content),
    }


@router.get("")
async def list_uploads(session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    user_dir = UPLOAD_DIR / str(user_id)
    if not user_dir.exists():
        return {"files": []}

    files = []
    status = rag_engine.get_status()
    indexed_files = status.get("files", [])

    for f in sorted(user_dir.iterdir()):
        if f.is_file():
            safe_name = f.name
            original_name = safe_name.split("_", 1)[-1] if "_" in safe_name else safe_name
            doc_id = f"user_{user_id}_{safe_name}"
            is_indexed = any(doc_id in idx for idx in indexed_files)
            stat = f.stat()
            files.append({
                "file_id": safe_name,
                "filename": original_name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "indexed": is_indexed,
            })

    return {"files": files}


@router.delete("/{file_id}")
async def delete_upload(file_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    user_dir = UPLOAD_DIR / str(user_id)
    file_path = safe_file_path(user_dir, file_id)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    doc_id = f"user_{user_id}_{file_id}"
    try:
        rag_engine.remove_document(doc_id)
    except Exception as e:
        logger.warning(f"Failed to remove from ChromaDB: {e}")

    file_path.unlink()
    return {"status": "ok", "message": "文件已删除"}


@router.post("/{file_id}/reindex")
async def reindex_upload(file_id: str, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    user_dir = UPLOAD_DIR / str(user_id)
    file_path = safe_file_path(user_dir, file_id)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        text = DocumentProcessor.process_file(str(file_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {str(e)}")

    original_name = file_id.split("_", 1)[-1] if "_" in file_id else file_id
    metadata = {
        "user_id": user_id,
        "filename": original_name,
        "safe_name": file_id,
    }
    doc_id = f"user_{user_id}_{file_id}"
    chunks = rag_engine.index_document_with_count(doc_id, text, metadata)

    return {"status": "ok", "chunks": chunks}
