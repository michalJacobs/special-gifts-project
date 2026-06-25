from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings.

    Values can be overridden with environment variables or a local .env file.
    The defaults are intentionally local-development friendly for this POC.
    """

    app_name: str = "Family Gift Fund Management System"
    database_url: str = "sqlite:///./local.db"
    jwt_secret_key: str = "dev-only-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    payment_webhook_secret: str = "dev-payment-webhook-secret"
    resend_api_key: str | None = "re_Suy6bBmN_BzokYS2VsTPMGK276y24sXFK"
    mail_from_address: str = "onboarding@resend.dev"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
