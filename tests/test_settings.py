import pytest

from app.settings import Settings, load_settings


def test_rejects_short_app_password(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "short")
    monkeypatch.setenv("SESSION_SECRET", "s" * 48)
    with pytest.raises(ValueError, match="at least 12"):
        load_settings()


def test_database_url_escapes_credentials():
    settings = Settings(
        database_host="db", database_port=5432, postgres_db="personal_ai",
        postgres_user="ai user", postgres_password="p@ss/word",
    )
    assert settings.database_url == (
        "postgresql+asyncpg://ai%20user:p%40ss%2Fword@db:5432/personal_ai"
    )
