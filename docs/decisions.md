# Decisions

These are the initial setup decisions recorded during Phase 1. They may evolve as implementation
begins, but they reflect the current intended direction.

## Decision 1

- **Chose:** Split the repository into top-level `frontend/` and `backend/` directories immediately.
- **Rejected:** Keeping everything in a single source tree until a framework choice is made.
- **Why:** The assignment clearly spans UI, API, and database concerns. Establishing the boundary now
  keeps later implementation organized and reduces the risk of mixing browser code with server
  responsibilities.

## Decision 2

- **Chose:** Preserve the assignment files and documentation scaffolding already present in the
  repository.
- **Rejected:** Replacing the root with generated application scaffolding or rewriting submission
  materials from scratch.
- **Why:** The assignment explicitly evaluates decision-making and documentation. Keeping these files
  visible from the start supports incremental delivery and avoids losing reviewer-facing context.

## Decision 3

- **Chose:** Leave Phase 1 directories intentionally empty except for version-control placeholders.
- **Rejected:** Creating starter application files, sample endpoints, or placeholder UI components.
- **Why:** The brief explicitly separates project initialization from implementation. Empty structure
  is the correct output at this stage and avoids accidental scope creep.

## Decision 4

- **Chose:** Plan around a relational database architecture.
- **Rejected:** A document-oriented or schema-light persistence model.
- **Why:** The domain depends on constrained relationships, lifecycle validation, reviewer assignment
  rules, and immutable history. Those requirements fit a relational model better than a flexible
  document store.

## Decision 5

- **Chose:** Document architecture and implementation phases before selecting concrete frameworks.
- **Rejected:** Locking in a frontend framework, backend framework, ORM, and hosting stack during
  repository setup.
- **Why:** The brief allows any stack, but Phase 1 is about structure and judgement. Capturing system
  boundaries first keeps the later stack decision tied to the real requirements rather than habit.

## Decision 6 — Node.js + TypeScript + Express Backend

### Chose

Node.js with TypeScript and Express for the backend API.

### Why

The application requires a straightforward HTTP API with clear middleware, routing, testing, and
server-side business-logic boundaries. TypeScript provides static typing as the domain becomes more
complex, while Express keeps the HTTP layer explicit and lightweight.

### Testing

Vitest and Supertest are used for the backend testing foundation.

### Status

Accepted.

## Decision 7 — PostgreSQL + Prisma

### Chose

PostgreSQL as the relational database and Prisma ORM as the TypeScript data-access and migration
layer.

### Why

The domain depends on explicit relationships, transactional workflow rules, durable constraints, and
auditable history. PostgreSQL provides a strong relational model, while Prisma provides typed schema
and client integration with the existing TypeScript backend.

### Rejected

No alternative ORM or persistence model was adopted because the application requirements favor a
relational, transaction-capable design.

### Status

Accepted.

## Decision 8 — Historical Decisions And Alerts As Separate Records

### Chose

Use a separate `FundingDecision` model and occurrence-based `OverdueAlert` rows rather than mutable
fields on an application or assignment.

### Why

One final decision per application is easier to query and audit as a dedicated record. Separate alert
occurrences preserve a dismissed alert while allowing a changed due date to produce a later overdue
condition.

### Status

Accepted.

## Decision 9 — Supabase Replaces Neon For Hosted PostgreSQL

### Initial Decision

Use Neon as the managed PostgreSQL hosting provider.

### Observed Result

Prisma repeatedly reported P1001 connectivity failures while attempting both Neon pooled and direct
connections from the development environment.

### Revised Decision

Use Supabase-hosted PostgreSQL instead.

### What Did Not Change

PostgreSQL remains the database, Prisma remains the ORM, and the relational schema design remains the
same.

### Rationale

Changing the hosting provider reduced setup friction and allowed migration and development to continue.
Later troubleshooting established that the college Wi-Fi network also blocked outbound PostgreSQL
connections: after changing networks, the Supabase session pooler on port 5432 was reachable and the
migration succeeded. This does not establish that Neon itself was defective; it records the information
available when the hosting decision was revised.

### Status

Accepted; supersedes the initial Neon hosting choice.

## Decision 11 — Application CRUD Uses Decimal Strings And Soft Archive

### Chose

Use decimal strings at the application API boundary, convert directly to Prisma Decimal for persistence, derive ownership from the authenticated Program Officer, and archive by setting `archivedAt`.

### Why

Decimal strings avoid JavaScript floating-point precision loss. Server-controlled ownership prevents clients from assigning applications to another officer. Dedicated archive/restore actions preserve historical data, while the general update route cannot bypass later lifecycle rules. Each application mutation writes an append-only audit event in the same transaction for the future timeline.

### Status

Accepted.

## Decision 10 — Bcryptjs And Stateless JWT Authentication

### Chose

Use bcryptjs password hashes, signed JWT bearer tokens, and reusable server-side role middleware.

### Why

The current application needs a small email/password authentication boundary without a full framework. Bcryptjs prevents plaintext password persistence, while stateless access tokens keep this phase focused on login and protected API access. JWTs carry only user identity and role; the backend verifies them and enforces Program Officer or Reviewer permissions independently of any client behavior.

### Deferred

Refresh tokens, password resets, email verification, OAuth, sessions, and registration remain out of scope until later requirements justify them.

### Status

Accepted.
