# Cogniverse Mock Analyzer

Cogniverse Mock Analyzer is a lean Next.js MVP that turns mock scorecards into deterministic insights, next-best actions, drills, and a next-mock strategy script. It is session-cookie only (guest mode) and stores attempts in MongoDB.

## Quick start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file:

```bash
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="cogniverse"
```

## Core flow

- **Dashboard** (`/`) → upload PDF or paste text → `POST /api/analyze`.
- **Report** (`/report/[id]`) → `GET /api/attempts/[id]` for the attempt + recommendation.

## API contracts

### `POST /api/analyze`
`multipart/form-data` with:

- `file?`: PDF (images accepted but OCR is not enabled yet)
- `text?`: pasted text
- `intake`: JSON string `{ goal, hardest, weekly_hours, next_mock_date?, preferred_topics? }`

Returns `{ ok: true, id, recommendationId, attempt, recommendation }`.

### `GET /api/attempts/[id]`
Returns `{ ok: true, attempt, recommendation }` for the current session cookie.

## Code map

See [`CODEMAP.md`](./CODEMAP.md) for the updated structure and data model.
