"""
Google Programmable Search Engine (Custom Search JSON API) client used for
job discovery via Google Web Search / Discovery (System.txt sections 8, 89-91).

We never scrape behind login/CAPTCHA/paywalls. We only issue `site:` queries
against the configured search engine and read back publicly indexed results.
If not configured, callers receive an empty list plus a note - never fake
results (rule 94: "No fake progress").
"""
from __future__ import annotations

import logging

import httpx

from app.config.settings import get_settings

logger = logging.getLogger("google_search")

SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


class SearchResult:
    def __init__(self, title: str, link: str, snippet: str):
        self.title = title
        self.link = link
        self.snippet = snippet

    def to_dict(self) -> dict:
        return {"title": self.title, "link": self.link, "snippet": self.snippet}


async def search(query: str, num: int = 10) -> list[SearchResult]:
    settings = get_settings()
    if not settings.google_search_configured:
        logger.warning(
            "GOOGLE_SEARCH_NOT_CONFIGURED query=%r (GOOGLE_SEARCH_API_KEY set=%s, "
            "GOOGLE_SEARCH_ENGINE_ID set=%s) — returning no results",
            query, bool(settings.google_search_api_key), bool(settings.google_search_engine_id),
        )
        return []
    params = {
        "key": settings.google_search_api_key,
        "cx": settings.google_search_engine_id,
        "q": query,
        "num": min(num, 10),
    }
    logger.info("GOOGLE_SEARCH_REQUEST query=%r cx=%s num=%s", query, settings.google_search_engine_id, params["num"])
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(SEARCH_URL, params=params)
            if resp.status_code == 429:
                logger.warning("GOOGLE_SEARCH_RATE_LIMITED query=%r body=%s", query, resp.text[:500])
                return []
            if resp.status_code >= 400:
                # Log the full response body — this is where CSE misconfiguration
                # (invalid key, API not enabled, CSE not set to search the whole
                # web, quota exceeded, billing not enabled, etc.) actually shows
                # up. A bare raise_for_status() throws this information away.
                logger.error(
                    "GOOGLE_SEARCH_HTTP_ERROR query=%r status=%s body=%s",
                    query, resp.status_code, resp.text[:1000],
                )
                resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("GOOGLE_SEARCH_REQUEST_FAILED query=%r error=%s", query, exc)
        return []

    items = data.get("items", []) or []
    search_info = data.get("searchInformation", {})
    logger.info(
        "GOOGLE_SEARCH_RESPONSE query=%r items_returned=%d total_results_reported=%s",
        query, len(items), search_info.get("totalResults", "unknown"),
    )
    if not items:
        # Log the full response when Google returned 200 but zero items — usually
        # means the CSE isn't configured to search the entire web (it's scoped to
        # specific sites only) or the query genuinely has no indexed matches.
        logger.warning("GOOGLE_SEARCH_ZERO_RESULTS query=%r full_response=%s", query, str(data)[:1000])
    return [SearchResult(i.get("title", ""), i.get("link", ""), i.get("snippet", "")) for i in items]
