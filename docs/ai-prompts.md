# AI-Assisted Development Record

AI was used as a paired implementation and review assistant. The records below preserve actual prompt text recoverable from repository history; they do not claim verbatim wording where the tracked record retained only an outcome.

## 1. Repository And Backend Foundation

**Prompt used**
```text
Complete only Phase 1 of the Grant Application Review System take-home. Inspect the current repository first, preserve SUBMISSION.md, create the requested frontend/backend directory structure, populate docs/plan.md with the provided phase roadmap, and avoid initializing the application itself.
```

**Prompt used**
```text
Build only the backend foundation for the Grant Application Review System: initialize a TypeScript, Node.js, and Express backend; separate app configuration from server startup; centralize environment configuration; implement a health route and JSON error handling; and establish Vitest/Supertest tests.
```

**Correction recorded:** Supertest could not open a listener in the restricted sandbox. The same implementation was validated in an environment allowing that listener; no production behavior was changed to accommodate the sandbox.

## 2. Database And Hosted PostgreSQL

**Prompt used**
```text
Add PostgreSQL and Prisma, design the relational grant-review schema, provide representative seed data, validate the Prisma artifacts, and keep application functionality deferred.
```

**Prompt used**
```text
Connect the existing PostgreSQL Prisma schema to a hosted database, create the initial migration, seed the development dataset, verify persisted counts and decision consistency, and accurately record any connection troubleshooting.
```

**Wrong-output/fix record:** Prisma 7 rejected the legacy datasource URL in `schema.prisma`; the URL moved to `prisma.config.ts`. Hosted Neon connection attempts failed, so the verified final host became Supabase PostgreSQL.

## 3. Authentication And Core Workflows

**Prompt used**
```text
Implement only password hashing, email/password login, JWT bearer authentication, current-user lookup, server-side Program Officer and Reviewer authorization, migrations, tests, and concise documentation.
```

**Prompt used**
```text
Implement Program Officer-only grant application create, list, detail, update, archive, and restore APIs with exact decimal handling, server-controlled ownership, transactional audit events, focused tests, and no reviewer or lifecycle workflow APIs.
```

**Prompt used**
```text
Implement only Phase 8 of the Grant Application Review System: add Program Officer lifecycle control for moving assigned applications into UNDER_REVIEW, add a dedicated funding-decision workflow that can finalize an application only from UNDER_REVIEW after at least three completed reviews, keep DECIDED unreachable through a generic status route, preserve transactional audit history, and avoid any Phase 9 or frontend work.
```

**Wrong-output/fix record:** The first Phase 8 prompt timed out without code changes. The work was split into smaller passes, then tests covered lifecycle and decision races, the completed-review threshold, and draft exclusion.

## 4. Later Phases And Review Gates

The tracked historical document records actual outcomes for reviewer assignment, review workflow, timeline/alerts, discovery/reporting, dashboard, frontend integration, acceptance fixes, and UI polish. It also records corrections for reassignment review uniqueness, malformed JSON handling, stale fixtures, safe projections, and async response ownership. The complete prior record remains available in repository history before the Phase 15 documentation rewrite; no missing exact prompt wording is reconstructed here.

## 5. Post-Phase-15 Audit And Calibration Stretch

**Prompt used**
```text
POST-PHASE-15 — LITERAL ASSIGNMENT COMPLIANCE AUDIT + REVIEWER CALIBRATION STRETCH

Audit the committed repository against the original assignment literally, especially documentation requirements and the free-tier deployment note. Implement ONE optional stretch feature: Reviewer calibration reports comparing how harshly or leniently reviewers score.
```

The resulting scope adds a Program Officer-only completed-review calibration report with optional funding-round filtering, a global benchmark, numeric differences, and a descriptive limited-data rule below three reviews. It does not add a schema migration or new infrastructure.
