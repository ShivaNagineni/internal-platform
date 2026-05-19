from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    mongo_uri: str = "mongodb://localhost:27017/"
    db_name: str = "internal_app"
    redis_url: str = "redis://localhost:6379/0"

    azure_ad_tenant_id: str = ""
    azure_ad_client_id: str = ""
    azure_ad_client_secret: str = ""

    azure_devops_org: str = ""
    azure_devops_projects: list[str] = []  # JSON array: ["ROCON Infra","KosmicEye"]
    azure_devops_team: str = ""  # optional — leave blank to use each project's default team
    azure_devops_pat: str = ""  # Personal Access Token (preferred over service principal)

    github_webhook_secret: str = ""
    github_token: str = ""
    github_repos: str = ""  # comma-separated, e.g. "owner/repo1,owner/repo2"

    def get_github_repos(self) -> list[str]:
        return [r.strip() for r in self.github_repos.split(",") if r.strip()]

    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_redirect_uri: str = "http://localhost:3000/auth/zoho/callback"

    slack_signing_secret: str = ""
    slack_bot_token: str = ""
    slack_webhook_url: str = ""
    slack_digest_channel: str = "#who-is-out"
    slack_release_channel: str = ""

    secret_key: str = "change-me-in-production"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    debug: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
