import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from api import chat, quiz, plan, user, knowledge, analysis, writing, focus, export, uploads, guidance, sync, community, knowledge_points, resources, reminders, search, streak, settings
from api.exception_handler import generic_exception_handler, validation_exception_handler, http_exception_handler
from db.database import init_db
from core.logger import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting AI Exam Agent server")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down AI Exam Agent server")


app = FastAPI(title="AI Exam Agent", version="0.5.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} → {response.status_code}")
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


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.5.0"}
