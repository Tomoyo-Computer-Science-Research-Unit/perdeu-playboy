from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Perdeu Playboy"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://rjviolencia:rjviolencia@localhost:5432/rjviolencia"
    redis_url: str | None = None
    isp_data_base_url: str = "https://www.ispdados.rj.gov.br/Arquivos"
    fogocruzado_api_token: str | None = None
    enable_fogocruzado: bool = False
    data_dir: Path = Path("../data")
    cors_origins: str = "http://localhost:3000,http://frontend:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
