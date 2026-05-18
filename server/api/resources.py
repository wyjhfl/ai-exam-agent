import os
import hashlib
import logging
from urllib.parse import urlparse, unquote
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_session
from db.models import QuizQuestion, UserUpload
from core.quiz.engine import QuizEngine
from core.rag.engine import RAGEngine

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)
router = APIRouter()
quiz_engine = QuizEngine()
rag_engine = RAGEngine()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "uploads"))
MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024


@router.get("/search")
async def search_resources(query: str, subject: str = None, resource_type: str = None, page: int = 1):
    search_query = f"考研 {query}"
    if subject:
        search_query += f" {subject}"

    url = f"https://html.duckduckgo.com/html/?q={search_query}"

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
    except Exception as e:
        logger.error(f"Search request failed: {e}")
        return {"results": [], "total": 0, "error": "搜索请求失败"}

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for div in soup.find_all("div", class_="result"):
        title_tag = div.find("a", class_="result__a")
        snippet_tag = div.find("a", class_="result__snippet")
        if not title_tag:
            continue

        title = title_tag.get_text(strip=True)
        href = title_tag.get("href", "")
        description = snippet_tag.get_text(strip=True) if snippet_tag else ""

        parsed_url = urlparse(href)
        from urllib.parse import parse_qs
        actual_url = href
        qs = parse_qs(parsed_url.query)
        if "uddg" in qs:
            actual_url = qs["uddg"][0]

        source_domain = urlparse(actual_url).netloc

        results.append({
            "title": title,
            "url": actual_url,
            "description": description[:200],
            "source_domain": source_domain,
        })

    return {"results": results, "total": len(results)}


@router.post("/download")
async def download_resource(request: dict, session: AsyncSession = Depends(get_session)):
    url = request.get("url")
    user_id = request.get("user_id")
    subject = request.get("subject", "")
    file_type = request.get("file_type", "")

    if not url or not user_id:
        return {"error": "url and user_id are required"}

    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()

            content_length = len(resp.content)
            if content_length > MAX_DOWNLOAD_SIZE:
                return {"error": f"文件过大 ({content_length // 1024 // 1024}MB)，限制 50MB"}

    except Exception as e:
        logger.error(f"Download failed: {e}")
        return {"error": f"下载失败: {str(e)}"}

    parsed = urlparse(url)
    filename = os.path.basename(unquote(parsed.path)) or ""
    if not filename or "." not in filename:
        filename = hashlib.md5(url.encode()).hexdigest()[:12]

    content_type = resp.headers.get("content-type", "")
    ext = os.path.splitext(filename)[1].lower()
    if not ext:
        if "pdf" in content_type:
            ext = ".pdf"
        elif "word" in content_type or "docx" in content_type:
            ext = ".docx"
        elif "text" in content_type:
            ext = ".txt"
        filename += ext

    filepath = os.path.join(user_dir, filename)
    counter = 1
    base, dot_ext = os.path.splitext(filepath)
    while os.path.exists(filepath):
        filepath = f"{base}_{counter}{dot_ext}"
        counter += 1

    with open(filepath, "wb") as f:
        f.write(resp.content)

    actual_filename = os.path.basename(filepath)
    file_id = hashlib.md5(f"{user_id}_{actual_filename}_{url}".encode()).hexdigest()[:16]

    indexed = False
    chunks = 0
    processable_exts = {".pdf", ".docx", ".txt", ".md"}
    if ext in processable_exts:
        try:
            from core.document_processor import DocumentProcessor
            dp = DocumentProcessor()
            text = dp.process_file(filepath)
            if text and text.strip():
                chunks = rag_engine.index_document_with_count(
                    doc_id=file_id,
                    text=text,
                    metadata={"user_id": user_id, "subject": subject, "filename": actual_filename, "source_url": url},
                )
                indexed = True
        except Exception as e:
            logger.warning(f"Failed to index downloaded file: {e}")

    upload_record = UserUpload(
        user_id=user_id,
        file_id=file_id,
        filename=actual_filename,
        subject=subject,
        file_type=file_type,
        file_path=filepath,
        file_size=content_length,
        indexed=indexed,
    )
    session.add(upload_record)
    await session.commit()

    return {
        "file_id": file_id,
        "filename": actual_filename,
        "subject": subject,
        "chunks": chunks,
        "size": content_length,
        "indexed": indexed,
    }


@router.post("/generate-from-url")
async def generate_from_url(request: dict, session: AsyncSession = Depends(get_session)):
    url = request.get("url")
    subject = request.get("subject", "数学")
    question_type = request.get("question_type", "single_choice")
    count = min(request.get("count", 5), 10)

    if not url:
        return {"error": "url is required"}

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
    except Exception as e:
        logger.error(f"Fetch URL failed: {e}")
        return {"error": f"获取网页失败: {str(e)}"}

    context = ""
    try:
        import trafilatura
        context = trafilatura.extract(resp.text) or ""
    except Exception:
        context = resp.text

    context = context[:3000]

    if not context.strip():
        return {"error": "无法提取网页内容"}

    prompt_topic = f"基于以下内容生成题目：\n\n{context[:2000]}"

    questions = await quiz_engine.generate_questions(
        subject=subject,
        topic=prompt_topic,
        difficulty="medium",
        count=count,
        question_type=question_type,
    )

    if not questions:
        return {"error": "AI 题目生成失败", "questions": []}

    saved = []
    for q_data in questions:
        q = QuizQuestion(
            subject=q_data.get("subject", subject),
            topic=q_data.get("topic", ""),
            difficulty=q_data.get("difficulty", "medium"),
            question_text=q_data["question_text"],
            question_type=q_data.get("question_type", question_type),
            options=q_data.get("options", []),
            answer=q_data["answer"],
            explanation=q_data.get("explanation", ""),
            source=f"URL生成: {url[:100]}",
        )
        session.add(q)
        saved.append(q)

    await session.commit()
    for q in saved:
        await session.refresh(q)

    return {
        "questions": [
            {
                "id": q.id,
                "subject": q.subject,
                "topic": q.topic,
                "difficulty": q.difficulty,
                "question_text": q.question_text,
                "question_type": q.question_type or "single_choice",
                "options": q.options or [],
                "answer": q.answer,
                "explanation": q.explanation,
            }
            for q in saved
        ],
        "total": len(saved),
    }
