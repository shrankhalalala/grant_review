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

## Complete Phase 5 grant application CRUD

### Prompt

Implement Program Officer-only grant application create, list, detail, update, archive, and restore APIs with exact decimal handling, server-controlled ownership, transactional audit events, focused tests, and no reviewer or lifecycle workflow APIs.

### What you got

The backend now exposes protected application CRUD routes. It accepts requested amounts as validated decimal strings, persists them with Prisma Decimal, returns decimal strings, derives ownership from the JWT identity, and rejects direct status, archive-state, and ownership changes. Creation, update, archive, and restore each add an append-only audit event in the same transaction.

### What you corrected

Strict TypeScript identified that Express route parameters may be arrays, so a narrow validated application-ID helper was added before service calls. No database schema change or migration was needed because the existing Application model already met Phase 5 requirements.

## Phase 5 review corrections

A read-only review found that update audit metadata did not identify field-level changes, archived retrieval lacked direct coverage, Reviewer archive/restore denial lacked direct coverage, and the README lacked a route summary. Updates now record only changed editable fields with before/after values; the missing regression tests and concise README route summary were added.

## Complete Phase 6 reviewer assignment

Implemented Program Officer assignment management, Reviewer self-assignment listing, due-date editing, soft removal, conflict and workload checks, transactional audit events, and isolated route tests. The existing schema supported the work without a migration.

## Phase 6 review corrections

A read-only review found that assignment creation did not move `SUBMITTED` applications to `ASSIGNED`, did not block `DECIDED` applications, and did not write the corresponding status audit event. It also found that soft-removed assignments could still have their due date edited and that direct regression coverage was incomplete. Assignment creation now performs the conditional transition and both audit writes in one transaction, due-date changes reject removed assignments, and focused route tests cover lifecycle, authorization, list history, removal, reassignment, and audit behavior.

## Complete Phase 7 review workflow

Implemented reviewer-owned draft creation, retrieval, editing, completion, score validation, conflict declaration, transactional audit events, and safe completed-review projection on Program Officer application detail. The existing nullable Review fields and unique constraints supported drafts and one review per assignment without a migration.

## Phase 7 review corrections

A read-only review found that permanent reviewer/application Review uniqueness conflicted with Phase 6 historical reassignment and could surface a raw Prisma unique error. The constraint is now scoped to `assignmentId`, with a defensive controlled conflict response for races. The first migration application attempt encountered a Prisma advisory-lock timeout (`P1002`); no reset was used, and a normal retry later confirmed the migration applied successfully.

## Phase 7 regression coverage completion

The second Phase 7 fix pass added direct mocked-Prisma regression coverage for reviewer retrieval and ownership, cross-reviewer and state-based mutation blocking, completed-review conflict refusal, historical reassignment review creation, and completed-only application-detail review projection.

## Phase 4 review corrections

A read-only review found that malformed JSON parser errors were being mapped to `500`. The central handler now preserves safe 4xx parser statuses with a generic response. Explicit regression tests were added for a missing login email, a correctly signed expired JWT, and malformed JSON.

## Complete Phase 8 application lifecycle and funding decisions

### Prompt

Implement only Phase 8 of the Grant Application Review System: add Program Officer lifecycle control
for moving assigned applications into `UNDER_REVIEW`, add a dedicated funding-decision workflow that
can finalize an application only from `UNDER_REVIEW` after at least three completed reviews, keep
`DECIDED` unreachable through a generic status route, preserve transactional audit history, and avoid
any Phase 9 or frontend work.

### What you got

The first Phase 8 prompt was too large and timed out without changing the code. The work was then
split into multiple smaller execution passes while still remaining one Git phase. The implemented
result adds `POST /applications/:id/status` for the explicit Program Officer `ASSIGNED` to
`UNDER_REVIEW` transition, `POST /applications/:id/decision` for final `APPROVED` or `DECLINED`
decisions, transactional lifecycle and decision audit events, enforcement that archived applications
cannot be changed, protection against duplicate immutable funding decisions, and `fundingDecision`
projection on application detail.

### What you corrected

Status-transition and funding-decision regression coverage were expanded to verify unauthorized
access, invalid state changes, the dedicated-only path to `DECIDED`, exact `COMPLETED` review-count
threshold behavior, draft exclusion from the threshold, actor and status override rejection, and
malformed JSON handling. A stale Phase 7 application-detail fixture was then corrected after it
caused misleading failures because the contract now expects `fundingDecision` instead of `decision`,
with archived retrieval fixtures updated to include `fundingDecision: null` and `reviews: []`. A
later read-through found that the funding-decision serializer was forwarding `decidedBy` too
broadly, so application detail serialization was hardened to exclude `passwordHash`, and direct
tests now assert safe decision and review projections.

## Phase 8 concurrency review corrections

A read-only Phase 8 review found two race conditions. The explicit Program Officer lifecycle
transition now uses an authoritative conditional `ASSIGNED` and unarchived state update inside its
transaction, so a competing request that affects zero rows returns a controlled conflict and writes
no duplicate lifecycle audit. The funding-decision workflow preserves the database's one-decision
constraint and translates only its `P2002` unique-constraint race into the same safe `409` duplicate
decision response. Focused regressions cover both guarded status-transition and duplicate-decision
race outcomes.

## Complete Phase 9 audit timeline, comments, and overdue alerts

Implemented Program Officer-only timeline retrieval and immutable application comments through
`AuditEvent`, plus overdue alert list, badge count, and idempotent dismissal APIs. Overdue alerts are
synchronized from incomplete, unremoved past-due assignments and preserve historical occurrences.
A unique assignment and due-date snapshot constraint prevents duplicate alerts, while a later due
date can create a new occurrence after it becomes overdue. Current alerts exclude dismissed,
completed, removed, and superseded assignments; comments are blocked on archived applications and
allowed on decided applications as informational notes.

## Phase 9 review corrections

A read-only review found no production blocker, but direct overdue lifecycle and decided-comment
coverage was incomplete and the schema documentation duplicated two sections. Focused regression
tests were added and the `AuditEvent` and `OverdueAlert` documentation was consolidated.
