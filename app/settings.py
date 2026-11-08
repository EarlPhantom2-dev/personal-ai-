from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote
import os


def _secret(name: str, *, required: bool = False) -> str:
    value = os.getenv(name, "")
    file_path = os.getenv(f"{name}_FILE", "")
    if file_path:
        value = Path(file_path).read_text(encoding="utf-8").strip()
    if required and not value:
        raise ValueError(f"{name} must be configured")
    return value


@dataclass(frozen=True)
class Settings:
    database_host: str
    database_port: int
    postgres_db: str
    postgres_user: str
    postgres_password: str
    app_password: str = ""
    session_secret: str = ""
    ninerouter_base_url: str = "http://ninerouter:20128/v1"
    ninerouter_api_key: str = ""
    chat_model: str = ""
    embedding_model: str = ""
    app_env: str = "production"
    cookie_secure: bool = True
    session_max_age: int = 604800
    memory_results: int = 5
    chat_history_limit: int = 20

    @property
    def database_url(self) -> str:
        user = quote(self.postgres_user, safe="")
        password = quote(self.postgres_password, safe="")
        database = quote(self.postgres_db, safe="")
        return f"postgresql+asyncpg://{user}:{password}@{self.database_host}:{self.database_port}/{database}"


def load_settings() -> Settings:
    app_password = _secret("APP_PASSWORD", required=True)
    session_secret = _secret("SESSION_SECRET", required=True)
    if len(app_password) < 12:
        raise ValueError("APP_PASSWORD must be at least 12 characters")
    if len(session_secret) < 32:
        raise ValueError("SESSION_SECRET must be at least 32 characters")
    chat_model = os.getenv("NINEROUTER_CHAT_MODEL", "").strip()
    embedding_model = os.getenv("NINEROUTER_EMBEDDING_MODEL", "").strip()
    if not chat_model or not embedding_model:
        raise ValueError("NINEROUTER_CHAT_MODEL and NINEROUTER_EMBEDDING_MODEL must be configured")
    return Settings(
        database_host=os.getenv("DATABASE_HOST", "db"),
        database_port=int(os.getenv("DATABASE_PORT", "5432")),
        postgres_db=os.getenv("POSTGRES_DB", "personal_ai"),
        postgres_user=os.getenv("POSTGRES_USER", "personal_ai"),
        postgres_password=_secret("POSTGRES_PASSWORD", required=True),
        app_password=app_password,
        session_secret=session_secret,
        ninerouter_base_url=os.getenv("NINEROUTER_BASE_URL", "http://ninerouter:20128/v1").rstrip("/"),
        ninerouter_api_key=_secret("NINEROUTER_API_KEY", required=True),
        chat_model=chat_model,
        embedding_model=embedding_model,
        app_env=os.getenv("APP_ENV", "production"),
        cookie_secure=os.getenv("COOKIE_SECURE", "true").lower() == "true",
        session_max_age=int(os.getenv("SESSION_MAX_AGE", "604800")),
        memory_results=max(1, min(20, int(os.getenv("MEMORY_RESULTS", "5")))),
        chat_history_limit=max(1, min(100, int(os.getenv("CHAT_HISTORY_LIMIT", "20")))),
    )
