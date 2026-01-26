# Cogniverse Mock Analyzer

Cogniverse Mock Analyzer is a lean Next.js MVP that turns mock scorecards into next-best actions and a 7-day execution plan. It uses a central state engine with event-based updates and supports anonymous, cookie-based usage.

## Quick start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file:

```bash
OPENAI_API_KEY="your-key"
OPENAI_MODEL="gpt-4o-mini"
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="cogniverse"
```

## Core flow

- **Landing** (`/`) → upload PDF or paste text → `POST /api/analyze`.
- UI emits events to `POST /api/events`, backend updates user state, and the bot reads that state.

## API contracts

### `POST /api/analyze`
Accepts `multipart/form-data` or JSON:

- `file?`: PDF (text-based only; scanned PDFs return a friendly error)
- `text?`: pasted scorecard text
- `intake?`: JSON string with optional intake answers

Returns a stable `AnalyzeResponse`:

```json
{
  "ok": true,
  "error": null,
  "meta": { "source": "pdf", "scannedPdf": false, "extractedChars": 1200 },
  "nextBestActions": [],
  "executionPlan": { "horizonDays": 7, "days": [] },
  "stateSnapshot": { "userId": "anon_...", "version": 4, "signals": {}, "facts": {} },
  "warnings": []
}
```

### `POST /api/bot`
Accepts `{ "message": "string" }` and returns:

```json
{
  "ok": true,
  "message": "Calm response...",
  "directives": [],
  "stateSnapshot": { "userId": "anon_...", "version": 5, "signals": {}, "facts": {} },
  "error": null
}
```

### `POST /api/events`
Accepts `{ type, payload?, ts? }` and returns:

```json
{
  "ok": true,
  "error": null,
  "stateSnapshot": { "userId": "anon_...", "version": 6, "signals": {}, "facts": {} }
}
```

## Code map

See [`CODEMAP.md`](./CODEMAP.md) for the updated structure and data model.
