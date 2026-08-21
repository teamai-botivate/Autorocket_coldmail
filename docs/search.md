# Google Web Search Setup (Job Discovery)

The Source Manager (`backend/app/sources/source_manager.py`) never scrapes
job portals directly — it only issues `site:`-scoped queries against a
Google Programmable Search Engine and reads back publicly indexed results.
This respects robots.txt/ToS/anti-bot systems (System.txt rule #8).

## 1. Enable the Custom Search API
[Google Cloud Console](https://console.cloud.google.com) → **APIs &
Services → Library** → enable **Custom Search API** → **Credentials →
Create Credentials → API key**. Put it in `GOOGLE_SEARCH_API_KEY`.

## 2. Create a Programmable Search Engine
1. Go to https://programmablesearchengine.google.com → **Add**.
2. Set it to search the **entire web**.
3. After creating, open **Setup / Basics** — the **Search engine ID**
   shown there is the same value the API calls `cx`. Put it in
   `GOOGLE_SEARCH_ENGINE_ID`.

## How queries are built
`source_manager.build_queries()` constructs one or more `site:<domain>`
queries per source per search (e.g.
`site:naukri.com "MIS Executive" "Raipur" "Chhattisgarh"`), scoped to the
user's selected job title/city/state — never a worldwide, unscoped search
when a location filter is set (rule #89-91).

## Behavior when not configured
If `GOOGLE_SEARCH_API_KEY`/`GOOGLE_SEARCH_ENGINE_ID` are empty,
`google_search.search()` returns an empty list and the affected source is
marked `UNAVAILABLE` in `SOURCE_STATUS` — the search run continues with
whatever other sources are configured, and never fabricates results.

## Quotas
The free tier of Custom Search JSON API allows 100 queries/day; paid tiers
scale from there. Each source × each search run issues 1-2 queries, so plan
`result_limit` and source selection accordingly for larger campaigns.
