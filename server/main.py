from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from api import chat, quiz, plan, user, knowledge, analysis, writing, focus, export
from api.exception_handler import generic_exception_handler, validation_exception_handler, http_exception_handler
from db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AI Exam Agent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
