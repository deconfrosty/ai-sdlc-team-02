# Project instructions

## Scope and stack

This repository implements the Todo App from the linked workshop PRPs. The workshop repository is documentation-only reference; do not modify it. Use the existing Next.js App Router, React, TypeScript, Tailwind CSS, better-sqlite3, WebAuthn, and Playwright stack. Do not add a framework or dependency without a concrete requirement and approval.

## Shared contracts

- `lib/db.ts` is the canonical home for domain types, SQLite initialization, and schema. Enable foreign keys and use prepared statements for every query.
- `lib/timezone.ts` is the canonical source for Singapore (`Asia/Singapore`) date/time formatting. Keep timezone-sensitive logic out of ad hoc `Date` conversions.
- Keep SQLite code server-only; client components must access data through API routes.
- API handlers must authenticate before database access and use the authenticated user ID for every user-owned record.
- In Next.js 16 route handlers, await promised `params`.
- Preserve existing interfaces when adding features; coordinate edits to shared files with other feature owners.

## Implementation and verification

- Read the matching PRP and its acceptance criteria before changing a feature.
- Use parameterized SQL, explicit input validation, and feature-focused error responses.
- Add unit/integration/E2E tests for behavior introduced; run `npm run lint`, `npm run typecheck`, relevant tests, and `npm run build`.
- Never commit credentials, `.env.local`, SQLite databases, or generated test output.
- An implementer must not approve their own pull request; follow `CONTRIBUTING.md` for review and merge gates.
