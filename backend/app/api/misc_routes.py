from fastapi import APIRouter, HTTPException

from app.repositories.repositories import (
    activity_log_repo, campaign_repo, settings_repo, job_repo, lead_repo, email_queue_repo, reply_repo,
)
from app.schemas.requests import SettingsPatchRequest
from app.services.analytics_service import get_dashboard, get_analytics
from app.utils.ids import new_id
from app.config.settings import get_settings

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/activity")
async def list_activity(lead_id: str | None = None, company_id: str | None = None,
                         activity_type: str | None = None, limit: int = 300):
    items = await activity_log_repo.list_all()
    if lead_id:
        items = [a for a in items if a.get("lead_id") == lead_id]
    if company_id:
        items = [a for a in items if a.get("company_id") == company_id]
    if activity_type:
        items = [a for a in items if a.get("activity_type") == activity_type]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return {"items": items[:limit], "total": len(items)}


@router.get("/campaigns")
async def list_campaigns():
    items = await campaign_repo.list_all()
    return {"items": items, "total": len(items)}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    campaign = await campaign_repo.get_by_id(campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    jobs = await job_repo.find_where(job_title=campaign.get("job_title", ""))
    leads = await lead_repo.list_all()
    queue = await email_queue_repo.list_all()
    replies = await reply_repo.list_all()
    return {
        **campaign,
        "funnel": {
            "jobs": len(jobs),
            "leads": len(leads),
            "emails_sent": len([q for q in queue if q.get("status") == "SENT"]),
            "replies": len(replies),
            "interested": len([l for l in leads if l.get("status") in ("INTERESTED", "MEETING_REQUESTED")]),
            "meetings": len([r for r in replies if r.get("reply_type") == "MEETING_REQUEST"]),
        },
    }


@router.post("/campaigns")
async def create_campaign(name: str, description: str = "", job_title: str = "", state: str = "",
                           city: str = "", sources: str = "", template_id: str = ""):
    return await campaign_repo.create({
        "campaign_id": new_id("campaign"), "name": name, "description": description,
        "job_title": job_title, "state": state, "city": city, "sources": sources,
        "template_id": template_id, "status": "DRAFT",
    })


@router.get("/analytics")
async def analytics(date_from: str | None = None, date_to: str | None = None):
    return await get_analytics(date_from, date_to)


@router.get("/dashboard")
async def dashboard():
    return await get_dashboard()


@router.get("/settings")
async def get_settings_route():
    items = await settings_repo.list_all()
    settings = get_settings()
    return {
        "values": {s["key"]: s["value"] for s in items},
        "env": {
            "email_test_mode": settings.email_test_mode,
            "mock_mode": settings.mock_mode,
            "max_follow_ups": settings.max_follow_ups,
            "queue_batch_size": settings.queue_batch_size,
            "queue_max_attempts": settings.queue_max_attempts,
            "sheets_configured": settings.sheets_configured,
            "openai_configured": settings.openai_configured,
            "web_search_configured": settings.tavily_configured,
        },
    }


@router.patch("/settings")
async def patch_settings(req: SettingsPatchRequest):
    for key, value in req.values.items():
        existing = await settings_repo.get_by_id(key)
        if existing:
            await settings_repo.update(key, {"value": value})
        else:
            await settings_repo.create({"key": key, "value": value, "description": ""})
    items = await settings_repo.list_all()
    return {"values": {s["key"]: s["value"] for s in items}}


@router.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "sheets_configured": settings.sheets_configured,
        "openai_configured": settings.openai_configured,
        "web_search_configured": settings.tavily_configured,
        "email_test_mode": settings.email_test_mode,
        "mock_mode": settings.mock_mode,
    }
