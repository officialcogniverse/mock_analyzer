# Cogniverse Mock Analyzer

Cogniverse Mock Analyzer is a Next.js app that turns mock scorecards into deterministic insights, next-best actions, a 7/14-day plan, and progress tracking.

## Quick start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file:

```bash
# MongoDB
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="cogniverse"

# NextAuth (Google)
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: OpenAI (used for OCR if enabled)
OPENAI_API_KEY=""
```

## Core flows

- **Upload → Analyze → Insights/NBAs/Plan → Progress → History**
- Deterministic signal aggregation (no embeddings or ML) for next-best actions and plan generation.

## Architecture

```mermaid
flowchart TD
  User((User)) -->|Sign in| NextAuth[NextAuth Google]
  User -->|Upload PDF/Image/Text| UploadUI[UploadCard]
  UploadUI --> AnalyzeAPI[/api/analyze]
  AnalyzeAPI --> Extract[PDF/OCR Extraction]
  AnalyzeAPI --> MongoAttempts[(attempts)]
  AnalyzeAPI --> MongoRecs[(recommendations)]

  User --> Dashboard[/app Dashboard]
  Dashboard --> ProgressAPI[/api/progress]
  Dashboard --> EventsAPI[/api/events]
  Dashboard --> NudgesAPI[/api/nudges]

  ProgressAPI --> MongoProgress[(progress_events)]
  EventsAPI --> MongoEvents[(events)]

  User --> History[/history]
  History --> HistoryAPI[/api/history]
  HistoryAPI --> MongoAttempts
  HistoryAPI --> MongoRecs

  User --> Account[/account]
  Account --> UserAPI[/api/user]
  Account --> ExportAPI[/api/account/export]
  Account --> DeleteAPI[/api/account/delete]
  UserAPI --> MongoUsers[(users)]
  ExportAPI --> MongoUsers
  DeleteAPI --> MongoUsers
```

For a diagram source file, see [`docs/architecture.mmd`](./docs/architecture.mmd).

## Code map

See [`CODEMAP.md`](./CODEMAP.md) for the detailed structure and data model.
