# Cogniverse Mock Analyzer

Cogniverse Mock Analyzer is a Next.js app that turns mock scorecards into deterministic next-best actions, a 7-day plan, and a checklist you can track over time.

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

- **Upload → Analyze → Actions/Plan → Checklist/Notes → History**
- Deterministic signal aggregation (no embeddings or ML) for next-best actions and plan generation.

## Architecture

```mermaid
flowchart TD
  User((User)) -->|Sign in| NextAuth[NextAuth Google]
  User -->|Upload PDF/Image/Text| UploadUI[UploadCard]
  UploadUI --> UploadAPI[/api/upload]
  UploadAPI --> MongoUploads[(uploads)]
  UploadAPI --> Extract[PDF/OCR Extraction]

  UploadUI --> AnalyzeAPI[/api/analyze]
  AnalyzeAPI --> MongoAttempts[(attempts)]
  AnalyzeAPI --> MongoAnalyses[(analyses)]
  AnalyzeAPI --> Signals[Signals Aggregator]

  User --> Dashboard[/app Dashboard]
  Dashboard --> ActionsAPI[/api/actions/mark-done]
  Dashboard --> NotesAPI[/api/notes]
  Dashboard --> EventsAPI[/api/events]
  Dashboard --> NudgesAPI[/api/nudges]

  ActionsAPI --> MongoActions[(actions)]
  NotesAPI --> MongoNotes[(notes)]
  EventsAPI --> MongoEvents[(events)]

  User --> History[/history]
  History --> HistoryAPI[/api/history]
  HistoryAPI --> MongoAttempts
  HistoryAPI --> MongoAnalyses
  HistoryAPI --> MongoUploads

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
