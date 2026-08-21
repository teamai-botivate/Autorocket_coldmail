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
        logger.warning("Google Search not configured — returning no results for query: %s", query)
        return []
    params = {
        "key": settings.google_search_api_key,
        "cx": settings.google_search_engine_id,
        "q": query,
        "num": min(num, 10),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(SEARCH_URL, params=params)
            if resp.status_code == 429:
                logger.warning("Google Search rate limited for query: %s", query)
                return []
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("Google Search request failed for %r: %s", query, exc)
        return []

    items = data.get("items", []) or []
    return [SearchResult(i.get("title", ""), i.get("link", ""), i.get("snippet", "")) for i in items]
