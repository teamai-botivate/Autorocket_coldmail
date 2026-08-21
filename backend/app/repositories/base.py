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
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.config.settings import get_settings
from app.integrations.sheets_client import SheetsClient
from app.utils.time_utils import iso_now

logger = logging.getLogger("repository")


class BaseRepository:
    SHEET_NAME: str = ""
    HEADERS: list[str] = []
    ID_FIELD: str = "id"

    def __init__(self) -> None:
        self.settings = get_settings()
        self._mem_store: list[dict[str, Any]] = []
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

    async def list_all(self) -> list[dict[str, Any]]:
        if self._use_sheets:
            return await run_in_threadpool(self.client.get_all_records, self.SHEET_NAME)
        return list(self._mem_store)

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
