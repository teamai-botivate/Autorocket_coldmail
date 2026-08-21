# CLAUDE.md — Botivate AI Job Intelligence & Outreach System

This file is kept up to date as the system is built. Read this before making
changes so context isn't lost across sessions.

## Source of truth
- `System.txt` — full original spec (140+ requirements). Do not contradict it.
- `docs/sheet-schema.md` — exact Google Sheet tabs/columns/enums used by
  backend, Apps Script, and frontend. All three must stay in sync with this.
- `.env.example` — all required environment variables.

## Architecture
```
backend/        FastAPI app (Python 3.11+, see backend/requirements.txt)
  app/config/       Settings (env-driven, see settings.py)
  app/models/       Enums / dataclasses mirroring docs/sheet-schema.md
  app/schemas/      Pydantic request/response schemas
  app/repositories/ Google Sheets CRUD (gspread), one repo class per tab
  app/services/      Business logic (dedup, scoring, queueing, suppression)
  app/sources/        Job source connectors (Naukri/Indeed/LinkedIn/Google CSE/etc.)
  app/agents/          OpenAI-backed agents (job extraction, company research,
                        opportunity scoring, email generation, reply analysis)
  app/api/             FastAPI routers, one per resource
  app/workers/          Background/async tasks triggered from API (search run)
  app/integrations/    OpenAI client wrapper, Google Search client, Apps Script bridge
  app/utils/            ids, time, location normalization, sanitization
apps-script/     Google Apps Script project (paste into script.google.com)
  Code.gs, Config.gs, SheetRepository.gs, EmailSender.gs, QueueWorker.gs,
  FollowUpWorker.gs, ReplyScanner.gs, EventLogger.gs, Utils.gs
frontend/        Next.js 14 (App Router) + TS + Tailwind + shadcn/ui
docs/            Setup docs (one per integration) + architecture.md
tests/           Backend pytest suite
```

## Non-negotiable rules (from System.txt)
- Google Sheets is the primary DB. Apps Script is the ONLY thing that actually
  sends email or scans Gmail — the FastAPI backend never sends email directly.
- `EMAIL_TEST_MODE=true` during development: ALL outgoing mail is redirected
  to `TEST_EMAIL`. Every email event must record `test_mode: true` when this
  is on.
- Never fabricate DELIVERED/OPENED/CLICKED/REPLIED unless a real signal (Gmail
  API / Apps Script event) produced it. If unknown, show
  "SENT — DELIVERY STATUS UNKNOWN" / "OPEN TRACKING NOT AVAILABLE".
- Follow-ups are user-scheduled by default (no auto date-picking) unless the
  user explicitly turns on automation. A reply always cancels pending
  follow-ups for that lead (reason `REPLIED`).
- Every entity has a UUID (`ids.py` helpers), never a spreadsheet row number.
- Idempotency: queue items and replies must not be double-processed (Apps
  Script uses `LockService` + status guards).
- No mock/fake data unless `MOCK_MODE=true` is explicitly set.

## Deployment target (per user instruction) — DONE
- **Render**, using **Docker**, **ONE web service** serving BOTH the FastAPI
  backend and the Next.js frontend (single exposed port). No `render.yaml`
  (user explicitly said it "won't work" for their setup — dashboard-configured
  Docker service only).
- Implemented: root `Dockerfile` (multi-stage: build Next.js standalone →
  install backend deps → final runtime image with Node + Python), root
  `start.py` (process supervisor: launches Next.js standalone on internal
  port 3000, then uvicorn on Render's `$PORT`), `backend/app/proxy.py`
  (FastAPI catch-all mounted LAST, after all `/api/*` routers, reverse-
  proxying everything else to the internal Next.js server). Frontend's
  `src/lib/api.ts` defaults `API_BASE` to `""` (same-origin) since prod
  shares one origin; local dev still sets `NEXT_PUBLIC_API_BASE_URL` to hit
  a separately-run backend. `next.config.ts` sets `output: "standalone"`.
  Full steps in `docs/deployment.md`.
- Local `pip install` / `npm install` are NOT to be run in this dev
  environment (Python 3.14 here lacks prebuilt wheels for some pinned
  versions, and per user instruction dependency installation happens on
  Render at build time instead). Code is still written and reasoned about
  locally — just not installed/run locally.
- git remote `origin` already points to
  `https://github.com/teamai-botivate/Autorocket_coldmail.git` — do NOT
  commit or push without the user explicitly asking first.

## Status (update this section as work progresses)
- [x] Repo inspected (was empty except System.txt) — plan drafted.
- [x] `docs/sheet-schema.md`, `.env.example`, `backend/app/config/settings.py` created.
- [x] Backend complete: enums/models, utils (ids/time/location), Sheets client
      + repositories (all 20 tabs), OpenAI agents (job extraction, company
      research, email discovery, opportunity analysis, email generation,
      reply analysis), Google Search source manager, services (activity,
      event bus/SSE, suppression, email queue, follow-up, reply ingestion,
      search orchestration, analytics/dashboard, bootstrap/seed), full API
      (search, catalog, leads, emails, templates, follow-ups, replies,
      misc/dashboard/analytics/settings/health), `main.py` wired up.
      Verified `import app.main` succeeds (loosened requirements.txt pins
      for Python 3.14 wheel availability — see requirements.txt).
- [x] Apps Script project complete (9/9 files): Config, Utils,
      SheetRepository, EmailSender, QueueWorker, FollowUpWorker,
      ReplyScanner, EventLogger, Code (triggers/menu/web app bridge).
- [x] Frontend (Next.js 16, App Router) — COMPLETE and verified.
      `npm run build` succeeds (25 routes, 22 static + 3 dynamic, 0 TS
      errors) and `npm run lint` passes with 0 errors (4 harmless
      react-hooks/exhaustive-deps warnings left as-is). All pages from
      System.txt built: dashboard, /search(+[id] SSE live progress),
      /search-runs, /sources, /jobs(+[id]), /companies(+[id]), /leads
      (table+Kanban+[id] detail w/ tabs), /outreach(+sent/not-sent/
      replied), /follow-ups(+calendar), /inbox(+[id] conversation view),
      /email-queue, /campaigns(+[id] funnel), /analytics (Recharts),
      /activity, /settings (templates manager). Full design system under
      src/components/ui/ (Radix + Tailwind + CVA, hand-built, no shadcn
      CLI). Real fixes applied to two genuine bugs found during
      verification: `fetcher` in src/lib/api.ts wasn't generic (caused
      every useSWR<T> call to type as unknown — fixed to
      `<T>(path): Promise<T>`), and `LeadDetail extends Lead` had an
      incompatible `notes` field override (Lead.notes: string vs
      LeadDetail.notes: LeadNote[] — fixed via `Omit<Lead, "notes">`).
      NOTE: on Windows, `npm install` can leave `node_modules/.bin/*.cmd`
      shims missing after antivirus/OneDrive file-lock interference on
      the Desktop path (confirmed cause of repeated `ENOTEMPTY`/missing-
      module errors during this build) — if `npm run build` ever fails
      with "'next' is not recognized", regenerate the shim or just run
      `node node_modules/next/dist/bin/next build` directly. This is a
      Windows-local-dev quirk only; the Linux-based Dockerfile build is
      unaffected.
- [ ] Dockerfile + docs/deployment.md for Render (single Docker web
      service serving both frontend and backend).
- [ ] Remaining docs (architecture/google-sheets/apps-script/gmail/openai/
      search/email-tracking/follow-ups/replies/security/troubleshooting),
      backend tests.

## Commands (once scaffolded)
- Backend dev: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Frontend dev: `cd frontend && npm install && npm run dev`
- Tests: `cd backend && pytest`
- Production: single `docker build` at repo root per `Dockerfile`, deployed
  as one Render Web Service (see docs/deployment.md once written).
