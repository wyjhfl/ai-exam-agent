import os
import sys
from pathlib import Path
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


def _get_app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


_PROJECT_ROOT = _get_app_root()
_DATA_DIR = _PROJECT_ROOT / "data"


class Settings(BaseSettings):
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://token-plan-cn.xiaomimimo.com/v1"
    LLM_MODEL: str = "mimo-v2.5-pro"

    DATABASE_DIR: str = str(_DATA_DIR)
    DATABASE_URL: str = ""

    CHROMA_PERSIST_DIR: str = str(_DATA_DIR / "chroma_db")
    KNOWLEDGE_BASE_DIR: str = str(_DATA_DIR / "knowledge-base")

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = str(_PROJECT_ROOT / "logs" / "app.log")

    model_config = ConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def __init__(self, **kwargs):
        from dotenv import load_dotenv
        env_path = _PROJECT_ROOT / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=True)
        super().__init__(**kwargs)
        if not self.DATABASE_URL:
            db_dir = Path(self.DATABASE_DIR)
            db_dir.mkdir(parents=True, exist_ok=True)
            self.DATABASE_URL = f"sqlite+aiosqlite:///{db_dir / 'ai_exam_agent.db'}"


settings = Settings()
