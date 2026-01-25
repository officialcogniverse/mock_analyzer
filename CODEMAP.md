# Code Map (Cogniverse Mock Analyzer)

## Purpose
A system-level map of the MVP: UI surfaces, API routes, data flows, and storage model.

## High-level architecture
- **Next.js App Router UI** in `app/` renders the dashboard and report.
- **Next.js API routes** in `app/api/*/route.ts` provide analysis + report retrieval.
- **MongoDB** stores attempts, recommendations, and lightweight strategy memory.
- **Deterministic rules engine** in `lib/engines/*` builds insights, next-best actions, probes, and 7/14-day plans.

## Main runtime flows
### 1) Upload → Analyze
1. **Dashboard** (`app/page.tsx`) posts multipart data to `/api/analyze`.
2. **Extraction**: `/api/analyze` parses PDF text (image OCR is disabled).
3. **Analyze**: `/api/analyze` creates an `attempt`, generates insights/NBAs/plan/probes, and stores a `recommendation`.

### 2) Report
- **Report page** (`app/report/[id]/page.tsx`) calls `/api/attempts/[id]`.
- **Response** includes the attempt + recommendation in one schema.

## Directory map
### `app/`
- `app/page.tsx`: dashboard.
- `app/report/[id]/page.tsx`: report UI.
- `app/api/analyze/route.ts`: analysis endpoint.
- `app/api/attempts/[id]/route.ts`: report payload endpoint.
- `app/api/chat/route.ts`: minimal helper bot.

### `components/`
- `components/navigation/SiteHeader.tsx`: top nav + theme toggle.
- `components/chat/ChatWidget.tsx`: floating helper dialog.
- `components/ui/*`: shadcn UI primitives used in the MVP.

### `lib/`
- `lib/mongodb.ts`: Mongo client and `getDb()`.
- `lib/db.ts`: collection names + indexes.
- `lib/engines/*`: deterministic analysis, insights, NBA, plan, probes, and strategy logic.
- `lib/schemas/*`: shared Zod schemas.
- `lib/session.ts`: cookie session utilities (guest identity).

## Data model (MongoDB)
- **attempts**: `userId`, `source`, `intake`, `exam`, `rawTextHash`, `known`, `inferred`, `missing`.
- **recommendations**: `userId`, `attemptId`, `insights`, `nbas`, `plan`, `probes`, `nextMockStrategy`.
- **memory_tuples**: per-user strategy memory (used to avoid repeating failed strategies).

## External dependencies
- **MongoDB**: `MONGODB_URI`, `MONGODB_DB`.
