"""
Daily automated search scheduler (per explicit user instruction: search for
MIS Executive jobs in Chhattisgarh automatically every day, targeting up to
150 new outreach-ready leads, with no manual button click required).

No external scheduler dependency (APScheduler etc.) is added — this is a
single lightweight asyncio background task started from main.py's lifespan,
matching the project's existing pattern of small in-process services
(event_bus.py, search_cancellation.py) rather than pulling in new
infrastructure for a single daily job.

Behavior:
- Runs once per day at DAILY_SEARCH_HOUR_IST (default 09:00 IST).
- Fixed search parameters: job_title="MIS Executive", state="Chhattisgarh".
- The 150/day cap is a TOTAL cap on newly-queued outreach emails for the
  day, shared with the one-time test-mode backlog resend utility
  (POST /api/settings/resend-test-mode-emails — see misc_routes.py): before
  starting, this counts how many EMAIL_QUEUE rows were already created
  today (real-mode leads from an earlier run today, or backlog rows the
  resend utility reset to PENDING today) and only asks execute_search() for
  the REMAINING slots, so the two mechanisms never together exceed 150
  emails queued in a calendar day (per explicit user instruction — real
  companies should never receive more than 150 cold emails/day from this
  system, avoiding both spam appearance and Gmail sending limits).
- If today's quota is already used up (e.g. the backlog resend alone used
  150), the scheduler skips today's automated search entirely.
- If a search run is still RUNNING when the next scheduled time arrives
  (shouldn't normally happen for a daily cadence, but guards against
  overlapping runs), the scheduler skips that tick rather than starting a
  second concurrent run.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.services.search_service import start_search, execute_search
from app.repositories.repositories import search_run_repo, email_queue_repo

logger = logging.getLogger("daily_search_scheduler")

IST = timezone(timedelta(hours=5, minutes=30))

DAILY_SEARCH_HOUR_IST = 9
DAILY_SEARCH_MINUTE_IST = 0

DAILY_JOB_TITLE = "MIS Executive"
DAILY_STATE = "Chhattisgarh"
DAILY_TOTAL_EMAIL_CAP = 150
DAILY_SOURCES = ["naukri", "indeed", "linkedin", "apna", "foundit", "timesjobs", "workindia", "shine", "internshala", "google_search"]

_scheduler_task: asyncio.Task | None = None


def _next_run_at(now: datetime) -> datetime:
    target = now.replace(hour=DAILY_SEARCH_HOUR_IST, minute=DAILY_SEARCH_MINUTE_IST, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target


async def _any_run_currently_active() -> bool:
    runs = await search_run_repo.list_all()
    return any(r.get("status") in ("PENDING", "RUNNING") for r in runs)


async def _emails_already_queued_today() -> int:
    """Counts EMAIL_QUEUE rows created today (IST) in any non-cancelled
    state — this covers both a real-mode search run's own queued emails and
    any backlog rows the resend-test-mode-emails utility reset to PENDING
    today, so both sources of sending share the same daily cap."""
    today_ist = datetime.now(IST).date()
    items = await email_queue_repo.list_all()
    count = 0
    for item in items:
        created_at = item.get("created_at") or ""
        if not created_at:
            continue
        try:
            created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00")).astimezone(IST)
        except ValueError:
            continue
        if created_dt.date() == today_ist and item.get("status") != "SKIPPED":
            count += 1
    return count


async def emails_remaining_today() -> int:
    """Public helper so other callers (e.g. the resend-test-mode-emails
    admin endpoint in misc_routes.py) can share this scheduler's notion of
    the daily total-email cap instead of hardcoding their own number."""
    already_queued_today = await _emails_already_queued_today()
    return max(DAILY_TOTAL_EMAIL_CAP - already_queued_today, 0)


async def _run_daily_search() -> None:
    if await _any_run_currently_active():
        logger.warning("DAILY_SEARCH: skipped — another search run is already PENDING/RUNNING")
        return

    remaining_quota = await emails_remaining_today()
    if remaining_quota <= 0:
        logger.info("DAILY_SEARCH: skipped — today's %d-email cap already reached "
                    "(e.g. via the test-mode backlog resend)", DAILY_TOTAL_EMAIL_CAP)
        return

    logger.info("DAILY_SEARCH: starting automated run job_title=%r state=%r remaining_quota=%d of %d cap",
                DAILY_JOB_TITLE, DAILY_STATE, remaining_quota, DAILY_TOTAL_EMAIL_CAP)
    run = await start_search(
        job_title=DAILY_JOB_TITLE, state=DAILY_STATE, city=None,
        date_filter="", experience=None, sources=DAILY_SOURCES,
        result_limit=remaining_quota,
    )
    try:
        await execute_search(run["run_id"])
        logger.info("DAILY_SEARCH: run %s finished", run["run_id"])
    except Exception:
        logger.exception("DAILY_SEARCH: run %s failed", run["run_id"])
        await search_run_repo.update(run["run_id"], {"status": "FAILED"})


async def _scheduler_loop() -> None:
    while True:
        now = datetime.now(IST)
        next_at = _next_run_at(now)
        sleep_seconds = (next_at - now).total_seconds()
        logger.info("DAILY_SEARCH: next automated run scheduled at %s IST (in %.0f minutes)",
                    next_at.isoformat(), sleep_seconds / 60)
        await asyncio.sleep(sleep_seconds)
        try:
            await _run_daily_search()
        except Exception:
            logger.exception("DAILY_SEARCH: unexpected error in scheduler tick")


def start_daily_search_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is not None:
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())
    logger.info("DAILY_SEARCH: scheduler started (daily %02d:%02d IST, %r in %r, daily cap=%d emails)",
                DAILY_SEARCH_HOUR_IST, DAILY_SEARCH_MINUTE_IST, DAILY_JOB_TITLE, DAILY_STATE, DAILY_TOTAL_EMAIL_CAP)


def stop_daily_search_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        _scheduler_task = None
