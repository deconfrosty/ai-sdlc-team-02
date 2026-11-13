# AI SDLC Team 02 Todo App

Shared foundation for the Todo App described by the [workshop PRPs](https://github.com/kenken64/AI-SDLC-Workshop-Day1n2/tree/low-token-usage/PRPs). This repository is the implementation target; the workshop repository is reference material only.

## Current foundation

- Next.js App Router, React, TypeScript, and Tailwind CSS
- SQLite connection/schema and shared domain types in `lib/db.ts`
- Singapore-time formatting helpers in `lib/timezone.ts`
- Playwright smoke-test setup and CI checks
- Authentication and product features are not implemented yet

The application targets Node.js 20.9 or newer. Building `better-sqlite3` on Windows may require Python 3 and Visual Studio C++ Build Tools. Copy `.env.example` to `.env.local` and set values as features require them. Never commit secrets or local database files.

## Local development

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test:e2e
npm run build
```

Playwright needs its Chromium browser installed once with `npx playwright install chromium`.

## Feature sequence

Establish schema and authentication/session support first; then implement PRP 01 (Todo CRUD), followed by PRPs 02–10 in their dependency order. The PRP index and one-shot spec differ on sequence; this project uses the agreed auth-first order. Do not implement beyond the approved feature scope.

## Contribution workflow

See [CONTRIBUTING.md](./CONTRIBUTING.md) for feature ownership boundaries, branch names, PR checks, and review requirements. The approved foundation commit initializes `main`; after that, use one branch and pull request per PRP feature and merge only after the required human approval.
