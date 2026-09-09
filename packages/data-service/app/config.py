from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Data service configuration loaded from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="DATA_", extra="ignore")

    app_name: str = "Career Intelligence Platform - Data Service"
    node_env: str = "development"
    log_level: str = "info"
    api_key: str = "change-me"
    api_port: int = 8000
    frontend_url: str = "http://localhost:5173"
    mongodb_uri: str = "mongodb://localhost:27017"
    market_db_name: str = "career_intelligence"


@lru_cache
def get_settings() -> Settings:
    return Settings()
