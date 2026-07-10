from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = ""
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    mem0_api_key: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    agent_allowed_origin: str = "http://localhost:3000"
    agent_email: str = ""
    agent_password: str = ""
    cron_secret: str = ""
    agent_pick_window_hours: int = 48
    agent_pick_batch_limit: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
