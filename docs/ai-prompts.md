# AI prompts

The prompts below reflect actual AI-assisted work performed so far on this repository.

## Complete Phase 1 repository initialization

### Prompt

Complete only Phase 1 of the Grant Application Review System take-home. Inspect the current
repository first, preserve `SUBMISSION.md`, create the requested frontend/backend directory
structure, populate `docs/plan.md` with the provided phase roadmap, and avoid initializing the
application itself.

### What you got

An implementation pass that first audited the repository contents, confirmed there was no remaining
application scaffolding, created the empty directory structure, and updated the planning and setup
documentation.

### What you corrected

The first instinct would have been to start generating application scaffolding or select a concrete
stack too early. That was intentionally avoided after re-checking the assignment constraints, because
Phase 1 is limited to structure and documentation only.

## Complete Phase 2 backend foundation

### Prompt

Build only the backend foundation for the Grant Application Review System: initialize a TypeScript,
Node.js, and Express backend; separate app configuration from server startup; centralize environment
configuration; implement a health route and JSON error handling; and establish Vitest/Supertest tests.

### What you got

A minimal Express backend with `app.ts` exporting the testable application, `server.ts` owning the
listener, validated environment configuration, `GET /health`, JSON 404 and error responses, and an
application-level health test suite.

### What you corrected

The initial test run was blocked by the restricted workspace sandbox, which does not permit Supertest
to open its temporary local listener. Re-running the same tests with local network permission resolved
the environment restriction. The work intentionally stopped at the HTTP and testing foundation;
database, authentication, and domain logic remain outside the scope.

## Complete Phase 3 database design and Prisma setup

### Prompt

Add PostgreSQL and Prisma, design the relational grant-review schema, provide representative seed data,
validate the Prisma artifacts, and keep application functionality deferred.

### What you got

A PostgreSQL Prisma schema for users, funding rounds, applications, assignments, reviews, conflicts,
audit events, overdue-alert occurrences, and funding decisions. The work also added a Prisma 7
configuration file, generated client, seed script, database URL validation helper, and schema
documentation covering constraints and future service-level rules.

### What you corrected

Prisma 7 rejected the legacy datasource URL in `schema.prisma`. The URL was moved to
`prisma.config.ts`, which is the required Prisma 7 configuration location. Prisma's official PostgreSQL
adapter was added so the seed can connect when a real `DATABASE_URL` is later supplied.

## Complete Phase 3 hosted database migration and verification

### Prompt

Connect the existing PostgreSQL Prisma schema to a hosted database, create the initial migration, seed
the development dataset, verify persisted counts and decision consistency, and accurately record any
connection troubleshooting.

### What you got

The initial migration was created and applied, the development seed executed, and the persisted data
was verified: seven users, two funding rounds, four applications, five assignments, four reviews, one
conflict, three audit events, one overdue alert, and one funding decision. The decided application has
three completed reviews and a funding decision. Prisma validation, generation, tests, and build passed.

### What you corrected

Initial Neon direct and pooled connection attempts returned Prisma P1001 errors. The hosted PostgreSQL
provider was changed to Supabase, where the initial attempt also failed. Manual network testing showed
that college Wi-Fi blocked PostgreSQL connections; after changing networks, the Supabase session pooler
became reachable, allowing the migration and seed to complete. Prisma CLI operations use `DIRECT_URL`,
while runtime database work retains `DATABASE_URL`.

## Complete Phase 4 authentication and authorization

### Prompt

Implement only password hashing, email/password login, JWT bearer authentication, current-user lookup, server-side Program Officer and Reviewer authorization, migrations, tests, and concise documentation.

### What you got

The backend now has bcryptjs-backed demo credentials, `POST /auth/login`, protected `GET /auth/me`, a reusable Prisma client, signed JWT access tokens, authenticated-request typing, and role middleware. Focused integration tests cover successful and failed login behavior, safe response shapes, bearer-token validation, and both role combinations. The password-hash migration was applied and the seed was rerun.

### What you corrected

Prisma migration generation did not create a new artifact through the Supabase endpoint despite reaching the database. A compatible migration was added without altering existing migration history: it adds the required column with a temporary empty default for existing rows, then removes that default. The idempotent development seed immediately replaces every demo account with a bcrypt hash. No database credentials or JWT secrets were added to tracked files.

## Phase 4 review corrections

A read-only review found that malformed JSON parser errors were being mapped to `500`. The central handler now preserves safe 4xx parser statuses with a generic response. Explicit regression tests were added for a missing login email, a correctly signed expired JWT, and malformed JSON.
