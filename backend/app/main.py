"""FastAPI entrypoint — Botivate AI Job Intelligence + Outreach System backend."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.services.bootstrap_service import seed_defaults
from app.api import (
    search_routes, catalog_routes, lead_routes, email_routes, template_routes,
    follow_up_routes, reply_routes, misc_routes,
)
from app.proxy import mount_frontend_proxy

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Botivate backend — sheets_configured=%s openai_configured=%s email_test_mode=%s",
                settings.sheets_configured, settings.openai_configured, settings.email_test_mode)
    await seed_defaults()
    yield
    logger.info("Shutting down Botivate backend")


app = FastAPI(
    title="Botivate AI Job Intelligence & Outreach API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_routes.router)
app.include_router(catalog_routes.router)
app.include_router(lead_routes.router)
app.include_router(email_routes.router)
app.include_router(template_routes.router)
app.include_router(follow_up_routes.router)
app.include_router(reply_routes.router)
app.include_router(misc_routes.router)


@app.get("/api")
async def api_root():
    return {"service": "Botivate AI Job Intelligence & Outreach API", "status": "running"}


# Must be mounted LAST: this is a catch-all that forwards any request not
# matched by the /api/* routers above to the Next.js frontend (see
# backend/app/proxy.py). Only active when FRONTEND_INTERNAL_URL is set,
# i.e. inside the combined single-container Docker image used on Render.
mount_frontend_proxy(app)
