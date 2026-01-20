# Code Map (Cogniverse)

## Purpose
This document provides a system-level map of the codebase so a data architect can design and evolve the platform architecture.

## High-level architecture
- **Next.js App Router UI** (React/TypeScript) renders the landing flow, dashboards, reports, and history pages. It also calls API routes under `app/api/*` for analysis and data access.
- **Node.js API routes** run inside Next.js (`app/api/.../route.ts`). These endpoints orchestrate data validation, storage, and analysis calls (OpenAI directly or via the Python service).
- **MongoDB** stores anonymous user profiles, mock attempts, strategy memory snapshots, and progress/probe data.
- **Optional Python analyzer service** (`python_service/main.py`) provides report generation and aggregated insights. The Next.js API can switch to this backend via environment configuration.

## Main runtime flows
### 1) Mock analysis pipeline
1. **UI intake + file upload**: `app/landing/page.tsx` collects exam, goal, struggles, and a PDF/text payload, then POSTs to `/api/analyze`.
2. **API intake validation + text extraction**: `/api/analyze` validates the intake schema, extracts PDF text, and detects the exam if needed.
3. **Analysis execution**:
   - **Node/OpenAI**: `lib/analyzer.ts` builds prompts and calls OpenAI models to generate the report + strategy plan.
   - **Python** (optional): `lib/pythonClient.ts` (invoked by `/api/analyze`) forwards analysis to the Python service when `ANALYZER_BACKEND="python"`.
4. **Persistence**: `/api/analyze` stores the raw text, intake, and generated report in `mock_attempts`, and stores a strategy snapshot in `strategy_memory`.
5. **UI navigation**: client routes to `/report/[id]`, which loads from `/api/report/[id]`.

### 2) History + report retrieval
- **History list**: `/api/history` returns recent `mock_attempts` metadata for the current anonymous user session.
- **Report detail**: `/api/report/[id]` loads a single attempt (report payload + metadata).

### 3) Insights (aggregated analysis)
- **API orchestration**: `/api/insights` loads the last N attempts, then calls the Python service `/insights` endpoint to build aggregated trends.

### 4) Progress + probes (study planning)
- **Progress state**: `/api/progress` reads/writes `user_progress` for probe completion, confidence, and planning settings.
- **User profile**: `/api/user` reads/writes `users` for display name, default exam, and coach settings.

## Directory map
### `app/`
- **`app/landing/page.tsx`**: main onboarding intake and analysis trigger.
- **`app/report/[id]/page.tsx`**: report display.
- **`app/history/page.tsx`**: history list.
- **`app/dashboard`**: user dashboards and progress views.
- **`app/api/*/route.ts`**: server-side API endpoints (analysis, history, insights, progress, user, session).

### `lib/`
- **`lib/analyzer.ts`**: OpenAI-powered report + strategy plan generation.
- **`lib/pythonClient.ts`**: API client for the Python analyzer backend.
- **`lib/extractText.ts`**: PDF text extraction.
- **`lib/persist.ts`**: MongoDB persistence (users, mock_attempts, strategy_memory, user_progress).
- **`lib/session.ts`**: anonymous session cookie management.
- **`lib/schema.ts`, `lib/types.ts`**: report schemas and shared types.

### `python_service/`
- **`python_service/main.py`**: FastAPI service for report generation and insights aggregation.

## Data model (MongoDB)
> Collection names and fields are inferred from the persistence layer. Confirm indexes + TTL requirements during architecture design.

- **`users`** (anonymous user profile)
  - `_id` (string userId), `displayName`, `examDefault`, `coach`, `createdAt`, `lastSeenAt`, `updatedAt`.
- **`mock_attempts`** (per mock analysis)
  - `userId`, `exam`, `intake`, `rawText`, `report`, `createdAt`.
- **`strategy_memory`** (strategy snapshots)
  - `userId`, `exam`, `attemptId`, `lever_titles`, `if_then_rules`, `confidence_score`, `confidence_band`, `_is_fallback`, `createdAt`.
- **`user_progress`** (study plan + probe tracking)
  - `userId`, `exam`, `nextMockInDays`, `minutesPerDay`, `probes`, `confidence`, `createdAt`, `updatedAt`.

## External dependencies
- **OpenAI**: used by `lib/analyzer.ts` (Node) and `python_service/main.py` (Python). Requires `OPENAI_API_KEY`.
- **MongoDB**: required for persistence (`MONGODB_URI`, `MONGODB_DB`).

## Configuration entry points
- **`.env.local`** (documented in README): `MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, `ANALYZER_BACKEND`, `PY_ANALYZER_URL`.

## Observability + scaling considerations (for architecture work)
- Add request tracing across `/api/analyze` and Python service calls.
- Consider background job queues for expensive PDF parsing or analysis workloads.
- Add MongoDB indexes for `mock_attempts.userId`, `mock_attempts.createdAt`, `strategy_memory.userId`, `user_progress.userId`.
