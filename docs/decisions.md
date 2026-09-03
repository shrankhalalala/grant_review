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

## Decision 12 — Reviewer Assignments Preserve History

Reviewer assignment removal sets `removedAt` and clears the active key rather than deleting records, preserving visible history and permitting reassignment. A removed assignment cannot be edited and does not regress the application lifecycle. A first valid assignment moves `SUBMITTED` to `ASSIGNED` with an immutable status audit event; archived and decided applications reject new assignments. Program Officers enforce conflict and five-active-assignment checks server-side; concurrent requests are not lock-serialized in this phase.

## Decision 13 — Review Drafts Are Reviewer-Owned And Immutable On Completion

Reviewers are identified only through JWT claims. Draft score fields are nullable, but supplied scores must be integers from 1 through 5; a dedicated completion action requires all three scores and makes the review immutable. The first draft changes `ASSIGNED` to `UNDER_REVIEW`, while archived and decided applications reject review mutations. Conflicts preserve assignments and drafts but block create, edit, and completion. Program Officers see completed reviews only, with safe reviewer data.

Review uniqueness is scoped to `assignmentId`, not permanently to the reviewer/application pair: Phase 6 soft removal allows historical reassignment, and each assignment requires its own review history.

## Decision 14 — Dedicated Decision Workflow And Explicit Officer Review Start

### Chose

Keep two separate lifecycle paths: Program Officers may explicitly move `ASSIGNED` applications to
`UNDER_REVIEW`, while `DECIDED` is reachable only through the dedicated funding-decision endpoint.

### Why

The assignment requires Program Officer control over the application lifecycle, but final funding
decisions carry stricter rules than a generic status update. Separating the endpoints prevents a
client from bypassing the completed-review threshold or decision-record creation, while remaining
compatible with the existing automatic Phase 7 transition when the first reviewer draft is created.

### Status

Accepted.

## Decision 15 — Decision Threshold Counts Completed Reviews Only

### Chose

Require at least three `COMPLETED` reviews before recording a funding decision, and exclude `DRAFT`
reviews from that threshold.

### Why

Only completed reviews represent finalized reviewer input. Counting drafts would allow incomplete or
mutable work to influence an irreversible decision.

### Status

Accepted.

## Decision 16 — Funding Decision Projection Must Be Singular And Sanitized

### Chose

Return application-detail decisions through the singular `fundingDecision` field and explicitly
serialize only safe decision-actor fields.

## Decision 17 — Append-Only Timeline Comments And Occurrence-Based Alerts

Application history remains append-only through `AuditEvent`; Program Officers can add immutable
timeline comments, which are blocked for archived applications but allowed after a decision as
informational notes. Timeline and comments are Program Officer-only. Overdue alerts are historical
occurrences identified by assignment and due-date snapshot, and dismissal is idempotent. Current
lists and badge counts re-check live assignment and review state, excluding completed, removed,
dismissed, and superseded occurrences. A database unique constraint and narrow `P2002` handling
protect concurrent synchronization.

### Why

The relation is one-to-one in the schema, so the API contract should expose either one decision or
`null`. A stale test fixture briefly masked that contract change, and a later serializer hardening
confirmed that forwarding the raw related user object risked leaking `passwordHash`.

### Status

Accepted.

## Decision 18 — Server-Side Discovery And Reused Bulk Assignment Rules

Application discovery remains server-side so search, filters, sorting, pagination, and total counts
reflect the database rather than a partial client cache. Bulk assignment delegates every pair to the
existing assignment service instead of using bulk inserts, preserving Phase 6 conflict, capacity,
duplicate, lifecycle, and audit invariants. CSV reporting exports completed reviews only and uses
separate score columns for portable analysis.

## Decision 10 — Bcryptjs And Stateless JWT Authentication

### Chose

Use bcryptjs password hashes, signed JWT bearer tokens, and reusable server-side role middleware.

### Why

The current application needs a small email/password authentication boundary without a full framework. Bcryptjs prevents plaintext password persistence, while stateless access tokens keep this phase focused on login and protected API access. JWTs carry only user identity and role; the backend verifies them and enforces Program Officer or Reviewer permissions independently of any client behavior.

### Deferred

Refresh tokens, password resets, email verification, OAuth, sessions, and registration remain out of scope until later requirements justify them.

### Status

Accepted.
