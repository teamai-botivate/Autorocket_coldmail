from fastapi import APIRouter, HTTPException, Query

from app.repositories.repositories import (
    email_draft_repo, email_queue_repo, email_event_repo, lead_repo, company_repo, job_repo,
)
from app.schemas.requests import EmailRejectRequest, EmailEditRequest, QueueRequest
from app.services.email_queue_service import queue_email
from app.services.activity_service import log_activity
from app.agents.email_generation import generate_initial_email
from app.utils.ids import new_id
from app.utils.time_utils import iso_now
from app.config.settings import get_settings

router = APIRouter(prefix="/api", tags=["emails"])


@router.get("/emails")
async def list_emails(status: str | None = None, limit: int = Query(300, le=2000)):
    items = await email_draft_repo.list_all()
    if status:
        items = [e for e in items if e.get("status") == status]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return {"items": items[:limit], "total": len(items)}


@router.get("/emails/{email_id}")
async def get_email(email_id: str):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    events = await email_event_repo.find_where(email_id=email_id)
    return {**email, "events": events}


@router.patch("/emails/{email_id}")
async def edit_email(email_id: str, req: EmailEditRequest):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    patch = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = await email_draft_repo.update(email_id, patch)
    await log_activity(lead_id=email.get("lead_id"), company_id=email.get("company_id"),
                        activity_type="EMAIL_GENERATED", description="Email manually edited", created_by="user")
    return updated


@router.post("/emails/{email_id}/approve")
async def approve_email(email_id: str):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    updated = await email_draft_repo.update(email_id, {"status": "APPROVED"})
    await lead_repo.update(email["lead_id"], {"status": "APPROVED"})
    await email_event_repo.create({
        "event_id": new_id("event"), "email_id": email_id, "lead_id": email["lead_id"],
        "company_id": email.get("company_id", ""), "event_type": "APPROVED", "timestamp": iso_now(),
        "message_id": "", "provider": "system", "metadata": "{}", "created_at": iso_now(),
    })
    await log_activity(lead_id=email["lead_id"], company_id=email.get("company_id"),
                        activity_type="EMAIL_APPROVED", description="Email approved by user", created_by="user")
    return updated


@router.post("/emails/{email_id}/reject")
async def reject_email(email_id: str, req: EmailRejectRequest):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    updated = await email_draft_repo.update(email_id, {"status": "REJECTED"})
    await log_activity(lead_id=email["lead_id"], company_id=email.get("company_id"),
                        activity_type="EMAIL_REJECTED", description=req.reason or "Rejected by user",
                        created_by="user")
    return updated


@router.post("/emails/{email_id}/regenerate")
async def regenerate_email(email_id: str):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    settings = get_settings()
    lead = await lead_repo.get_by_id(email["lead_id"]) or {}
    company = await company_repo.get_by_id(email.get("company_id", "")) or {}
    job = await job_repo.get_by_id(lead.get("job_id", "")) or {}
    signals = [s for s in (lead.get("automation_signals") or "").split(",") if s]
    pains = [p for p in (lead.get("pain_points") or "").split(",") if p]
    generated = generate_initial_email(
        company_name=company.get("company_name", ""), job_title=job.get("job_title", ""),
        city=company.get("city"), contact_name=None, automation_signals=signals, pain_points=pains,
        sender_name=settings.botivate_sender_name, botivate_website=settings.botivate_website_url,
    )
    updated = await email_draft_repo.update(email_id, {
        "subject": generated["subject"], "plain_text_body": generated["plain_text_body"],
        "html_body": generated["html_body"], "confidence": generated["confidence"],
        "personalization_points": ",".join(generated["personalization_points"]),
        "facts_used": ",".join(generated["facts_used"]), "status": "DRAFT",
    })
    await log_activity(lead_id=email["lead_id"], company_id=email.get("company_id"),
                        activity_type="EMAIL_GENERATED", description="Email regenerated", created_by="user")
    return updated


@router.post("/emails/{email_id}/queue")
async def queue_approved_email(email_id: str, req: QueueRequest):
    email = await email_draft_repo.get_by_id(email_id)
    if not email:
        raise HTTPException(404, "Email not found")
    if email.get("status") not in ("APPROVED",):
        raise HTTPException(400, "Email must be APPROVED before queueing")
    queued = await queue_email(email, scheduled_at=req.scheduled_at, priority=req.priority)
    return queued


@router.get("/email-queue")
async def list_email_queue(status: str | None = None, limit: int = Query(300, le=2000)):
    items = await email_queue_repo.list_all()
    if status:
        items = [q for q in items if q.get("status") == status]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return {"items": items[:limit], "total": len(items)}


@router.get("/email-queue/{queue_id}")
async def get_queue_item(queue_id: str):
    item = await email_queue_repo.get_by_id(queue_id)
    if not item:
        raise HTTPException(404, "Queue item not found")
    return item
