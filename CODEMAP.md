# Code Map (Cogniverse Mock Analyzer)

## Purpose
A system-level map of the codebase: UI surfaces, API routes, data flows, and storage model.

## High-level architecture
- **Next.js App Router UI** in `app/` renders landing, dashboard, account, and history.
- **Next.js API routes** in `app/api/*/route.ts` provide analysis, recommendations, progress updates, history, and bots.
- **MongoDB** stores user profiles, attempts, recommendations, progress events, and events.
- **Deterministic rules engine** in `lib/engines/*` builds insights, next-best actions, and 7/14-day plans.

## Main runtime flows
### 1) Upload → Analyze
1. **Upload + analyze**: `components/upload/UploadCard.tsx` posts multipart data to `/api/analyze`.
2. **Extraction**: `/api/analyze` parses PDF text or image OCR (OpenAI if configured).
3. **Analyze**: `/api/analyze` creates an `attempt`, generates insights/NBAs/plan, and stores a `recommendation`.

### 2) Plan + Progress
- **Plan updates**: `components/analysis/PlanPathway.tsx` calls `/api/progress` to persist task status changes.
- **Progress tracking**: `components/analysis/ProgressTracker.tsx` displays completion and blockers.

### 3) History
- `/api/history` aggregates attempts + recommendations for `/history`.

### 4) Account + Onboarding
- `/api/user` reads/writes the user profile document.
- `/api/account/export` returns a JSON export.
- `/api/account/delete` soft deletes the account (sets `deletedAt`).

### 5) Events + Nudges + Bots
- `/api/events` logs product events into `events`.
- `/api/nudges` computes deterministic nudges from event history.
- `/api/bot/*` provides feature-helper and EI bots.

## Directory map
### `app/`
- `app/page.tsx`: public landing page.
- `app/app/page.tsx`: authenticated dashboard.
- `app/account/page.tsx`: account settings.
- `app/history/page.tsx`: history list.
- `app/api/*/route.ts`: server APIs.

### `components/`
- `components/upload/UploadCard.tsx`: multi-input upload UI.
- `components/analysis/*`: NBA list, plan, insights, and progress.
- `components/bot/BotWidget.tsx`: helper + EI bot UI.
- `components/share/ShareCard.tsx`: shareable summary UI.

### `lib/`
- `lib/auth.ts`: NextAuth config.
- `lib/mongodb.ts`: Mongo client and `getDb()`.
- `lib/db.ts`: collection names + indexes.
- `lib/engines/*`: deterministic analysis, insights, NBA, plan, and memory logic.
- `lib/engine/nudges.ts`: nudge rules.
- `lib/schemas/*`: shared Zod schemas.

## Data model (MongoDB)
- **users**: `userId`, `email`, `displayName`, `examGoal`, `weeklyHours`, `preferences`, `onboardingCompleted`, `deletedAt`.
- **attempts**: `userId`, `source`, `exam`, `rawTextHash`, `known`, `inferred`, `missing`.
- **recommendations**: `userId`, `attemptId`, `insights`, `nbas`, `plan`, `strategy`.
- **progress_events**: `userId`, `recommendationId`, `type`, `payload`.
- **events**: `userId`, `eventName`, `payload`, `timestamp`.

## External dependencies
- **MongoDB**: `MONGODB_URI`, `MONGODB_DB`.
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- **OpenAI** (optional OCR): `OPENAI_API_KEY`.
