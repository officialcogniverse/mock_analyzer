This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Configuration

Create a `.env.local` file with the following values:

```bash
# Required
MONGODB_URI="mongodb://localhost:27017"

# Optional (defaults to "cogniverse")
MONGODB_DB="cogniverse"

# Optional: use the Python analyzer
ANALYZER_BACKEND="python"
PY_ANALYZER_URL="http://127.0.0.1:8000"
```

The app uses an httpOnly cookie for anonymous sessions, so the API no longer requires a client-supplied `userId`.

If you set `ANALYZER_BACKEND="python"`, ensure the Python service is running at `PY_ANALYZER_URL`.

## Code Map (for architecture work)

For a system-level view of the services, data flows, and storage model, see [`CODEMAP.md`](./CODEMAP.md).

## Product roadmap ideas

The following feature ideas are prioritized for impact and data leverage:

1. **User accounts + data portability**: allow login (email/OTP) so users keep history across devices; add export to CSV/JSON for coaching use.
2. **Exam-specific schema enforcement**: tighten input normalization (CAT/NEET/JEE) with per-exam section schema, enabling richer analytics and fewer assumptions.
3. **Personalized drill recommendations**: map weaknesses → curated practice sets; track outcomes to refine strategy recommendations.
4. **Adaptive timing coach**: collect per-section timing data (manual or OCR) to generate pacing rules and section order guidance.
5. **Cohort insights dashboard**: aggregate anonymized trends to show percentile benchmarks, common mistakes, and progress velocity.
6. **Scheduled nudge + plan adherence**: reminders for daily plan tasks, streaks, and mock prep countdown to reduce drop-off.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
