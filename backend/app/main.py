from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        from app.models.user import User
        await User.find({"theme": {"$ne": "dark"}}).update({"$set": {"theme": "dark"}})
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Startup theme migration failed: %s", exc)
    if settings.azure_ad_client_secret:
        try:
            from app.services.graph_service import sync_users_from_azure
            import logging
            result = await sync_users_from_azure()
            logging.getLogger(__name__).info("Startup Azure AD sync: %s", result)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Startup Azure AD sync failed (non-fatal): %s", exc)
    yield


app = FastAPI(
    title="Internal Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import leave, ideas, releases, stats, users, notifications, webhooks, auth, departments, repositories, stories  # noqa: E402

app.include_router(auth.router, prefix="/api")
app.include_router(leave.router, prefix="/api")
app.include_router(ideas.router, prefix="/api")
app.include_router(releases.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(repositories.router, prefix="/api")
app.include_router(stories.router, prefix="/api")
app.include_router(webhooks.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
