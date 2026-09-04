# Database Schema

The Phase 3 schema is defined in `backend/prisma/schema.prisma` for PostgreSQL. Prisma owns the
relational mapping and migrations; PostgreSQL owns persistence, foreign keys, unique constraints, and
indexes.

## Models

### User

`id` is a CUID string primary key. `email` is a unique string, `name` is a string, and `role` is the
`UserRole` enum (`PROGRAM_OFFICER` or `REVIEWER`). `passwordHash` is a required bcrypt hash managed
only by the backend; plaintext passwords are never stored. `createdAt` and `updatedAt` are timestamps.
One user can own applications, receive reviewer assignments, write reviews, declare conflicts, act in
audit events, and record funding decisions.

### FundingRound

`id` is a CUID primary key. `name` is a unique string; `description` is nullable text; `opensAt`,
`closesAt`, `createdAt`, and `updatedAt` are timestamps. A funding round has many applications.

### Application

`id` is a CUID primary key. It stores `organizationName`, `contactEmail`, `requestedAmount` as
`Decimal(12,2)`, `submittedAt`, `status` (`SUBMITTED`, `ASSIGNED`, `UNDER_REVIEW`, or `DECIDED`),
nullable `archivedAt`, `ownerId`, `fundingRoundId`, and creation/update timestamps. It belongs to one
Program Officer and one funding round, and has assignments, reviews, conflicts, audit events, and at
most one funding decision.

`ownerId` is server-controlled when an application is created and identifies the owning Program Officer. The Phase 5 API accepts `requestedAmount` as an exact decimal string and persists it as `Decimal(12,2)`; responses serialize it as a decimal string. `archivedAt` is changed only by dedicated archive/restore actions, while the general update route cannot change archive state, owner, or lifecycle status. Phase 8 adds dedicated lifecycle workflows: Program Officers can explicitly move `ASSIGNED` applications to `UNDER_REVIEW`, and only the funding-decision workflow can move an application to `DECIDED`.

### ReviewerAssignment

Phase 6 treats an assignment as active when it has not been removed and has no completed review. `removedAt` preserves assignment history while `activeAssignmentKey` is cleared on removal. Due dates can change only before review completion and soft removal; removed assignments remain visible in assignment history.

`id` is a CUID primary key. It has `applicationId`, `reviewerId`, `assignedAt`, `dueAt`, nullable
`completedAt`, nullable `removedAt`, and timestamps. `activeAssignmentKey` is nullable but unique: an
active assignment stores the deterministic `applicationId:reviewerId` value, and removal clears it.

### Review and ConflictOfInterest

`Review` is unique by `assignmentId`, with nullable draft scores and `DRAFT`/`COMPLETED` status. Historical soft-removed assignments retain their reviews, while a reassignment can create a separate review on its new assignment. Completion sets `completedAt`; completed records are immutable. `ConflictOfInterest` stores the server-derived reviewer and application, a required reason, and an active uniqueness key. Active conflicts block review mutations but preserve the assignment and any existing draft.
This permits historical reassignment records while preventing two active rows for the same pair.

### Review

`id` is a CUID primary key. It stores `applicationId`, `reviewerId`, unique `assignmentId`, status
(`DRAFT` or `COMPLETED`), nullable integer scores for impact, feasibility, and budget justification,
nullable comments, nullable `completedAt`, and timestamps. The persisted uniqueness rule is per
assignment, not permanently per `(applicationId, reviewerId)`, so a historical soft-removed
assignment can keep its review while a later reassignment receives its own review row.

### ConflictOfInterest

`id` is a CUID primary key. It stores `applicationId`, `reviewerId`, `reason`, `declaredAt`, nullable
`resolvedAt`, and timestamps. Like assignments, nullable unique `activeConflictKey` stores the active
`applicationId:reviewerId` pair and is cleared on resolution, retaining conflict history while
preventing duplicate unresolved declarations.

### AuditEvent

`id` is a CUID primary key. It stores `applicationId`, nullable `actorId`, a flexible `eventType`
string, nullable JSON `metadata`, and `createdAt`. It deliberately has no `updatedAt`; application
services treat this model as append-only history. Phase 9 application timelines expose these events,
and immutable application comments use `APPLICATION_COMMENT_ADDED` metadata. There are no event edit
or delete APIs.

### OverdueAlert

`id` is a CUID primary key. It stores `assignmentId`, `dueAtSnapshot`, `triggeredAt`, nullable
`dismissedAt`, and `createdAt`. Each row represents an occurrence rather than a mutable assignment
flag, so a dismissed occurrence is retained and not recreated, while a later due-date change can
generate a new alert. The unique `(assignmentId, dueAtSnapshot)` constraint provides the concurrent
duplicate guard.

### FundingDecision

`id` is a CUID primary key. It stores unique `applicationId`, decision enum (`APPROVED` or
`DECLINED`), nullable `amountAwarded` as `Decimal(12,2)`, nullable notes, `decidedById`, `decidedAt`,
and `createdAt`. A separate model provides a clear, auditable final decision record.

## Relationships

One-to-many relationships include funding rounds to applications; Program Officers to owned
applications; applications to assignments, reviews, conflicts, and audit events; reviewers to
assignments, reviews, and conflicts; assignments to overdue alerts; and users to decisions they make.

Reviewer assignment and conflict declaration are each many-to-many relationships between users and
applications, represented by explicit join models because both carry domain attributes. Reviews are
also linked through an assignment and retain direct application/reviewer foreign keys for reporting
and uniqueness checks.

## Constraints And Indexes

PostgreSQL enforces primary keys, foreign keys, unique user emails, unique funding-round names, one
review per assignment, one decision per application, and the nullable active-key uniqueness rules.
Required historical relationships use `Restrict` deletion; an audit actor may be deleted only by
setting `actorId` to null, which preserves the event.

Indexes support expected server-side queries: application status, round, owner, submission/archive
dates, organization, and contact email; reviewer assignment lookup, due/completion/removal state and
active workload; review application/reviewer/status; conflict resolution state; audit chronology; and
overdue-alert state and chronology.

Score values are integers, but the applied initial migration contains no database CHECK constraint for
the `1..5` range. Future request and service validation will enforce the range; a PostgreSQL CHECK can
be added in a reviewed migration if database-level enforcement becomes necessary.

## Archive And History Strategy

Applications use nullable `archivedAt` rather than deletion, so an archive/restore workflow can retain
all related assignments, reviews, decisions, and history. Audit events are append-only records with no
`updatedAt`, while distinct overdue-alert rows preserve each overdue occurrence and dismissal.

## Application-Enforced Rules

The following rules require transactions, time-dependent queries, or workflow context and therefore
belong in later service logic rather than a static row constraint:

- A reviewer may have at most five active assignments.
- An unresolved conflict blocks assignment.
- Application status transitions must be valid and role-restricted.
- At least three completed reviews are required before an application becomes `DECIDED`.
- Draft reviews do not count toward the funding-decision threshold.
- Completed reviews are immutable.
- Funding decisions are immutable and `DECIDED` is reachable only through the dedicated decision workflow.

The database schema preserves enough history and indexes to enforce these rules atomically in future
services.

## Deliberate Denormalization

Reviews retain `applicationId` and `reviewerId` even though their assignment identifies both. This
keeps the common review/reporting queries direct and allows a database uniqueness constraint without
joining. `activeAssignmentKey` and `activeConflictKey` are derived keys used to represent partial
uniqueness while retaining historical rows.

## Scale Outlook

At 100x scale, cross-application search and reporting joins over applications, assignments, reviews,
and audit history will become the first likely bottleneck. The selected indexes protect the planned
filters; later work should add query measurement, cursor pagination, and reporting-specific indexes
before introducing denormalized reporting tables.

## Dashboard Aggregates

Phase 11 uses the existing application status and submission-date indexes, assignment due/removal
indexes, review status/application indexes, and funding-decision date index for read-only dashboard
aggregates. No schema or migration was required; application history, including archived records,
remains preserved by the existing model.
