import os
from pathlib import Path
from pydantic_settings import BaseSettings

_PROJECT_ROOT = Path(__file__).resolve().parent


class Settings(BaseSettings):
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://token-plan-cn.xiaomimimo.com/v1"
    LLM_MODEL: str = "mimo-v2.5-pro"

    DATABASE_DIR: str = str(_PROJECT_ROOT.parent / "data")
    DATABASE_URL: str = ""

    CHROMA_PERSIST_DIR: str = str(_PROJECT_ROOT.parent / "data" / "chroma_db")
    KNOWLEDGE_BASE_DIR: str = str(_PROJECT_ROOT.parent / "data" / "knowledge-base")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def __init__(self, **kwargs):
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).parent / ".env", override=True)
        super().__init__(**kwargs)
        if not self.DATABASE_URL:
            db_dir = Path(self.DATABASE_DIR)
            db_dir.mkdir(parents=True, exist_ok=True)
            self.DATABASE_URL = f"sqlite+aiosqlite:///{db_dir / 'ai_exam_agent.db'}"


settings = Settings()
