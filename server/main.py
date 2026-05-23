import logging
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from api import chat, quiz, plan, user, knowledge, analysis, writing, focus, export, uploads, guidance, sync, community, knowledge_points, resources, reminders, search, streak, settings, exam_papers, conversations, admin
from api.exception_handler import generic_exception_handler, validation_exception_handler, http_exception_handler
from db.database import init_db, async_session
from core.logger import setup_logging

logger = logging.getLogger(__name__)

RATE_LIMITS = {
    "/api/chat/stream": ("30/minute", 30),
    "/api/chat/guided": ("20/minute", 20),
    "/api/quiz/generate": ("20/minute", 20),
    "/api/quiz/adaptive": ("20/minute", 20),
    "/api/quiz/mock-exam": ("10/minute", 10),
    "/api/resources/search": ("10/minute", 10),
    "/api/resources/download": ("5/minute", 5),
    "/api/resources/generate-from-url": ("5/minute", 5),
    "/api/uploads/upload": ("10/minute", 10),
    "/api/writing/evaluate": ("10/minute", 10),
    "/api/plan/generate": ("5/minute", 5),
    "/api/exam-papers/import": ("5/minute", 5),
}

_rate_limit_store: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))


def _check_rate_limit(path: str, client_ip: str) -> str | None:
    if path not in RATE_LIMITS:
        return None
    _, max_requests = RATE_LIMITS[path]
    now = time.time()
    window = 60.0
    key = f"{path}:{client_ip}"
    timestamps = _rate_limit_store[path][client_ip]
    timestamps[:] = [t for t in timestamps if now - t < window]
    if len(timestamps) >= max_requests:
        return RATE_LIMITS[path][0]
    timestamps.append(now)
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting AI Exam Agent server v0.8.0")
    logger.info("Python executable: %s", sys.executable)
    logger.info("Frozen: %s", getattr(sys, "frozen", False))
    if getattr(sys, "frozen", False):
        from pathlib import Path
        app_root = Path(sys.executable).resolve().parent
        logger.info("App root (frozen): %s", app_root)
    from config import settings
    logger.info("Database dir: %s", settings.DATABASE_DIR)
    logger.info("Database URL: %s", settings.DATABASE_URL)
    await init_db()
    logger.info("Database initialized")
    try:
        from pathlib import Path
        from core.exam_loader import load_all_exams_from_dir
        exams_dir = str(Path(__file__).parent / "data" / "exams")
        async with async_session() as db_session:
            await load_all_exams_from_dir(exams_dir, db_session)
        logger.info("Exam data loading completed")
    except Exception as e:
        logger.warning("Failed to load exam data: %s", e)
    try:
        from core.data_cleanup import cleanup_orphaned_files
        cleanup_orphaned_files()
        logger.info("Orphaned files cleanup completed")
    except Exception as e:
        logger.warning("Failed to cleanup orphaned files: %s", e)
    logger.info("Server starting on http://127.0.0.1:8000")
    yield
    logger.info("Shutting down AI Exam Agent server")


app = FastAPI(title="AI Exam Agent", version="0.7.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_and_log(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    limit_hit = _check_rate_limit(path, client_ip)
    if limit_hit:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded: {limit_hit}"},
        )

    logger.info(f"{request.method} {path}")
    response = await call_next(request)
    logger.info(f"{request.method} {path} → {response.status_code}")
    return response


app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)

app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(plan.router, prefix="/api/plan", tags=["plan"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(writing.router, prefix="/api/writing", tags=["writing"])
app.include_router(focus.router, prefix="/api/focus", tags=["focus"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(guidance.router, prefix="/api/guidance", tags=["guidance"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(community.router, prefix="/api/community", tags=["community"])
app.include_router(knowledge_points.router, prefix="/api/knowledge-points", tags=["knowledge-points"])
app.include_router(resources.router, prefix="/api/resources", tags=["resources"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["reminders"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(streak.router, prefix="/api/streak", tags=["streak"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(exam_papers.router, prefix="/api/exam-papers", tags=["exam-papers"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/health")
async def health_check():
    checks = {"status": "ok", "version": "0.8.0"}
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        checks["status"] = "degraded"
    return checks


if __name__ == "__main__":
    import socket
    import uvicorn

    def is_port_in_use(port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("127.0.0.1", port)) == 0

    if is_port_in_use(8000):
        import subprocess
        try:
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True, text=True, timeout=5,
            )
            for line in result.stdout.splitlines():
                if ":8000" in line and "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) != 0:
                        subprocess.run(["taskkill", "/F", "/PID", pid], timeout=5)
                        logger.info("Killed stale process on port 8000 (PID: %s)", pid)
                        import time
                        time.sleep(1)
                    break
        except Exception as e:
            logger.warning("Failed to clean up port 8000: %s", e)

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
