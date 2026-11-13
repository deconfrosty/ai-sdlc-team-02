# AI SDLC Team 02 Todo App

Shared foundation for the Todo App described by the [workshop PRPs](https://github.com/kenken64/AI-SDLC-Workshop-Day1n2/tree/low-token-usage/PRPs). This repository is the implementation target; the workshop repository is reference material only.

## Current foundation

- Next.js App Router, React, TypeScript, and Tailwind CSS
- SQLite connection/schema and shared domain types in `lib/db.ts`
- Singapore-time formatting helpers in `lib/timezone.ts`
- WebAuthn passkey registration, sign-in, additional authenticators, and logout
- Seven-day HTTP-only JWT session cookies and protected home/calendar routes
- Playwright smoke, database, timezone, and virtual-authenticator tests

The application targets Node.js 22 or newer. Building `better-sqlite3` on Windows may require Python 3 and Visual Studio C++ Build Tools. Copy `.env.example` to `.env.local`; set `SESSION_SECRET` to a random secret of at least 32 bytes, and set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to the production relying-party domain and HTTPS origin. Development defaults support `localhost`. Never commit secrets or local database files.

Authentication challenges and logout revocations are stored in SQLite. For the
current implementation, run a single app instance with a durable database file
that survives restarts and retains revocations until their tokens expire. Do
not deploy multiple instances with separate database files or use ephemeral
storage: either can allow a logged-out token to become valid again. A
multi-instance deployment requires a shared durable authentication store and
an appropriate database architecture before release.

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
