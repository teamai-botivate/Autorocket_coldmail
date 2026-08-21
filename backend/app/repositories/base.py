"""
Base repository providing header-mapped CRUD over a single Google Sheet tab.
All entity repositories subclass this with SHEET_NAME, HEADERS, ID_FIELD.

MOCK_MODE fallback: when Google Sheets is not configured (e.g. local dev
without credentials) and settings.mock_mode is True, repositories operate
on an in-process list so the API remains usable for UI development. This is
never used to fabricate business data — it is empty until the user creates
records through the API.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.config.settings import get_settings
from app.integrations.sheets_client import SheetsClient
from app.utils.time_utils import iso_now

logger = logging.getLogger("repository")

# How long a list_all() snapshot is reused before re-reading the sheet.
# The Google Sheets API defaults to a 60 reads/minute/user quota; every
# GET endpoint that fans out across several sheets (e.g. /api/dashboard
# reads 8 of them) can blow that quota on its own within a couple of
# refreshes, even with zero search activity. A short cache collapses
# repeated reads of the same sheet within this window into one real API
# call, while writes (create/update) still invalidate immediately so
# nothing goes stale for longer than this TTL.
LIST_CACHE_TTL_SECONDS = 8.0


class BaseRepository:
    SHEET_NAME: str = ""
    HEADERS: list[str] = []
    ID_FIELD: str = "id"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._mem_store: list[dict[str, Any]] = []
        self._list_cache: list[dict[str, Any]] | None = None
        self._list_cache_at: float = 0.0
        self._use_sheets = self.settings.sheets_configured
        if self._use_sheets:
            self.client = SheetsClient.instance()
            try:
                self.client.ensure_worksheet(self.SHEET_NAME, self.HEADERS)
            except Exception as exc:  # pragma: no cover - network dependent
                logger.error("Failed to ensure worksheet %s: %s", self.SHEET_NAME, exc)
        else:
            self.client = None
            if not self.settings.mock_mode:
                logger.warning(
                    "Sheets not configured and MOCK_MODE is off — %s repository has no persistence",
                    self.SHEET_NAME,
                )

    @staticmethod
    def _serialize(value: Any) -> Any:
        if isinstance(value, (list, dict)):
            return json.dumps(value, ensure_ascii=False)
        if value is None:
            return ""
        return value

    def _row_from_record(self, record: dict[str, Any]) -> list[Any]:
        return [self._serialize(record.get(h, "")) for h in self.HEADERS]

    def _invalidate_list_cache(self) -> None:
        self._list_cache = None
        self._list_cache_at = 0.0

    async def list_all(self, *, force_refresh: bool = False) -> list[dict[str, Any]]:
        if not self._use_sheets:
            return list(self._mem_store)
        now = time.monotonic()
        if (
            not force_refresh
            and self._list_cache is not None
            and (now - self._list_cache_at) < LIST_CACHE_TTL_SECONDS
        ):
            return self._list_cache
        rows = await run_in_threadpool(self.client.get_all_records, self.SHEET_NAME)
        self._list_cache = rows
        self._list_cache_at = now
        return rows

    async def get_by_id(self, id_value: str) -> dict[str, Any] | None:
        if self._use_sheets:
            found = await run_in_threadpool(
                self.client.find_row_by_id, self.SHEET_NAME, self.ID_FIELD, id_value
            )
            return found[1] if found else None
        for r in self._mem_store:
            if r.get(self.ID_FIELD) == id_value:
                return r
        return None

    async def create(self, record: dict[str, Any]) -> dict[str, Any]:
        record.setdefault("created_at", iso_now())
        record.setdefault("updated_at", iso_now())
        full = {h: record.get(h, "") for h in self.HEADERS}
        if self._use_sheets:
            await run_in_threadpool(self.client.append_row, self.SHEET_NAME, self._row_from_record(full))
            self._invalidate_list_cache()
        else:
            self._mem_store.append(full)
        return full

    async def update(self, id_value: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        patch = dict(patch)
        patch["updated_at"] = iso_now()
        if self._use_sheets:
            found = await run_in_threadpool(
                self.client.find_row_by_id, self.SHEET_NAME, self.ID_FIELD, id_value
            )
            if not found:
                return None
            row_number, existing = found
            merged = {**existing, **{k: self._serialize(v) for k, v in patch.items()}}
            await run_in_threadpool(
                self.client.update_row_simple, self.SHEET_NAME, row_number, self.HEADERS, merged
            )
            self._invalidate_list_cache()
            return merged
        for r in self._mem_store:
            if r.get(self.ID_FIELD) == id_value:
                r.update({k: self._serialize(v) for k, v in patch.items()})
                return r
        return None

    async def find_where(self, **filters: Any) -> list[dict[str, Any]]:
        rows = await self.list_all()
        out = []
        for r in rows:
            if all(str(r.get(k, "")) == str(v) for k, v in filters.items()):
                out.append(r)
        return out

    async def find_one_where(self, **filters: Any) -> dict[str, Any] | None:
        rows = await self.find_where(**filters)
        return rows[0] if rows else None
