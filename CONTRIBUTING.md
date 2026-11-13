# Contribution workflow

## Branch and pull request

- This product-owner-approved foundation initializes `main`; start subsequent tasks from its current tip.
- Use `feature/prp-XX-short-name` for feature branches and `fix/short-name` for fixes.
- Keep each pull request limited to one PRP feature or a prerequisite explicitly approved by the product owner.
- Include the PRP acceptance criteria addressed and the commands/checks run in the pull request description.
- Do not push directly to `main` after the foundation commit, merge your own pull request, or treat another agent's approval as product-owner approval.
- The implementing agent cannot approve its own work. Require independent QA review; require independent security review for authentication, authorization, import/export, and other security-sensitive changes.

## Feature ownership map

| PRP | Feature | Prerequisites |
|---|---|---|
| 11 | WebAuthn authentication and sessions | Shared schema |
| 01 | Todo CRUD | Shared schema and sessions |
| 02 | Priority | PRP 01 |
| 03 | Recurring todos | PRP 01, 02 |
| 04 | Reminders and notifications | PRP 01 |
| 05 | Subtasks and progress | PRP 01 |
| 06 | Tags | PRP 01 |
| 07 | Templates | PRPs 01–05 |
| 08 | Search and filtering | PRPs 01, 02, 06 |
| 09 | Export and import | PRPs 01, 05, 06 |
| 10 | Calendar | PRPs 01, 02, 11 |

Use the shared `lib/db.ts` types/schema and `lib/timezone.ts` helpers rather than creating duplicate contracts. Keep every database query parameterized and scope user-owned records to the authenticated session. Coordinate changes to shared files (`lib/db.ts`, `app/page.tsx`, package manifests) before opening overlapping pull requests.

## Required checks

Every pull request must pass CI: ESLint, TypeScript, production build, and Playwright smoke tests. Add feature-specific unit/integration/E2E coverage from the corresponding PRP; smoke tests do not count as feature acceptance coverage.

No merge or production deployment is authorized by this workflow alone; obtain explicit product-owner approval.
