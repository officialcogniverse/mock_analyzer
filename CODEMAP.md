# Code Map (Cogniverse Mock Analyzer)

## Purpose
A system-level map of the codebase: UI surfaces, API routes, data flows, and storage model.

## High-level architecture
- **Next.js App Router UI** in `app/` renders landing, dashboard, account, and history.
- **Next.js API routes** in `app/api/*/route.ts` provide uploads, analysis, checklist updates, notes, history, and bots.
- **MongoDB** stores user profiles, uploads, attempts, analyses, actions, notes, and events.
- **Deterministic rules engine** in `lib/engine/*` builds next-best actions and 7-day plans.

## Main runtime flows
### 1) Upload → Analyze
1. **Upload**: `components/upload/UploadCard.tsx` posts to `/api/upload`.
2. **Extraction**: `/api/upload` parses PDF text or image OCR (OpenAI if configured) and stores metadata in `uploads`.
3. **Analyze**: `/api/analyze` creates an `attempt`, runs deterministic signals aggregation, and stores an `analysis` with NBA + plan.

### 2) Checklist + Notes
- **Checklist**: `components/analysis/Checklist.tsx` calls `/api/actions/mark-done` to store completion per action.
- **Notes**: `components/analysis/NotesPanel.tsx` calls `/api/notes` to store reflections.

### 3) History
- `/api/history` aggregates attempts + analyses + uploads, returning cards for `/history`.

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
- `components/analysis/*`: NBA list, plan, checklist, and notes.
- `components/bot/BotWidget.tsx`: helper + EI bot UI.
- `components/share/ShareCard.tsx`: shareable summary UI.

### `lib/`
- `lib/auth.ts`: NextAuth config.
- `lib/mongodb.ts`: Mongo client and `getDb()`.
- `lib/db.ts`: collection names + indexes.
- `lib/engine/signals.ts`: deterministic NBA + plan builder.
- `lib/engine/nudges.ts`: nudge rules.
- `lib/schemas/*`: shared Zod schemas.

## Data model (MongoDB)
- **users**: `userId`, `email`, `displayName`, `examGoal`, `weeklyHours`, `preferences`, `onboardingCompleted`, `deletedAt`.
- **uploads**: `userId`, `type`, `filename`, `mimeType`, `size`, `extractedText`, `storageRef`.
- **attempts**: `userId`, `uploadId`, `exam`, `rawTextHash`.
- **analyses**: `userId`, `attemptId`, `summary`, `nba`, `plan`, `signalsUsed`.
- **actions**: `userId`, `analysisId`, `actionId`, `done`, `completedAt`.
- **notes**: `userId`, `analysisId`, `actionId`, `content`.
- **events**: `userId`, `eventName`, `payload`, `timestamp`.

## External dependencies
- **MongoDB**: `MONGODB_URI`, `MONGODB_DB`.
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- **OpenAI** (optional OCR): `OPENAI_API_KEY`.
