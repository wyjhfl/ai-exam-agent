import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy import select, delete
from db.database import async_session
from db.models import ChatHistory, QuizRecord, UserUpload

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parent.parent / "data" / "uploads"))


async def cleanup_old_chat_history(days: int = 90) -> int:
    cutoff = datetime.utcnow() - timedelta(days=days)
    async with async_session() as session:
        result = await session.execute(
            delete(ChatHistory).where(ChatHistory.created_at < cutoff)
        )
        await session.commit()
        deleted = result.rowcount
        logger.info(f"Cleaned up {deleted} chat history records older than {days} days")
        return deleted


async def cleanup_old_quiz_records(days: int = 180) -> int:
    cutoff = datetime.utcnow() - timedelta(days=days)
    async with async_session() as session:
        result = await session.execute(
            delete(QuizRecord).where(QuizRecord.created_at < cutoff)
        )
        await session.commit()
        deleted = result.rowcount
        logger.info(f"Cleaned up {deleted} quiz records older than {days} days")
        return deleted


def cleanup_orphaned_files() -> int:
    if not os.path.exists(UPLOAD_DIR):
        return 0
    cleaned = 0
    for user_dir in Path(UPLOAD_DIR).iterdir():
        if not user_dir.is_dir():
            continue
        for file_path in user_dir.iterdir():
            if file_path.is_file():
                file_id = file_path.name
                cleaned += 1
    logger.info(f"Scanned upload directory, found files in {UPLOAD_DIR}")
    return cleaned


async def run_full_cleanup(chat_days: int = 90, quiz_days: int = 180) -> dict:
    chat_deleted = await cleanup_old_chat_history(chat_days)
    quiz_deleted = await cleanup_old_quiz_records(quiz_days)
    return {
        "chat_history_deleted": chat_deleted,
        "quiz_records_deleted": quiz_deleted,
    }
