# Schema Reference

The PostgreSQL schema lives in `backend/prisma/schema.prisma`; committed Prisma migrations are the database history.

| Model | Purpose | Important constraints |
| --- | --- | --- |
| `User` | Program Officers and Reviewers. | Unique email, bcrypt `passwordHash`, role enum. |
| `FundingRound` | Named application period. | Unique name; opening/closing timestamps. |
| `Application` | Grant request and lifecycle record. | Decimal(12,2) amount; owner and round FKs; nullable `archivedAt`. |
| `ReviewerAssignment` | Reviewer work item. | Historical soft removal and unique active pair key. |
| `Review` | Draft or completed evaluation. | One review per assignment; three score columns. |
| `ConflictOfInterest` | Reviewer conflict declaration. | Unique active conflict pair key; preserves history. |
| `FundingDecision` | Final approved/declined outcome. | One decision per application; Decimal(12,2) award amount. |
| `AuditEvent` | Append-only application timeline entry. | Event type, JSON metadata, optional actor, no update timestamp. |
| `OverdueAlert` | Historical overdue occurrence. | Unique `(assignmentId, dueAtSnapshot)` identity. |

## Relationships

- A Funding Round has many Applications.
- A Program Officer owns Applications and can record Decisions and Audit Events.
- An Application has assignments, reviews, conflicts, audit events, and zero or one decision.
- A Reviewer has assignments, reviews, and conflict declarations.
- An Assignment has zero or one Review and many Overdue Alerts.

Assignment and conflict models carry workflow fields, so they are explicit relationship models rather than implicit join tables.

## Lifecycle And History

`Application.status` is `SUBMITTED`, `ASSIGNED`, `UNDER_REVIEW`, or `DECIDED`; services control its transitions. `archivedAt` is independent of status so archiving preserves all related history.

`ReviewerAssignment.removedAt` retains prior work. While active, `activeAssignmentKey` contains the application/reviewer pair; removal clears it, preventing duplicate active work while permitting reassignment. Conflicts use the same active-key approach.

`Review.status` is `DRAFT` or `COMPLETED`. Completion writes `completedAt` and is immutable at the service boundary. Audit events never update. Alerts preserve dismissed and superseded occurrences.

## Precision And Enforcement

Requested and awarded amounts use `Decimal(12,2)` and API responses serialize fixed two-decimal strings, avoiding JavaScript floating-point loss.

PostgreSQL enforces primary/foreign keys, email/round-name uniqueness, one review per assignment, one decision per application, active-key uniqueness, and overdue occurrence uniqueness. Service transactions enforce rules that need current time or cross-row context: reviewer capacity, conflict blocking, valid transitions, ownership, review completion requirements, and the three-completed-review decision threshold. Score bounds are validated in request/service code rather than a database `CHECK` constraint.

## Columns And Types

All IDs are CUID strings. Core fields are PostgreSQL text/string columns, `DateTime` timestamps, nullable timestamps for historical state, integer review scores, JSON audit metadata, and the enum values `PROGRAM_OFFICER|REVIEWER`, `SUBMITTED|ASSIGNED|UNDER_REVIEW|DECIDED`, `DRAFT|COMPLETED`, and `APPROVED|DECLINED`. `Application.requestedAmount` and `FundingDecision.amountAwarded` are `Decimal(12,2)`. The Prisma schema is the exhaustive field/type source; the model table above identifies each persisted entity and its material columns/constraints.

### Complete Persisted Field List

| Model | Persisted fields and Prisma types |
| --- | --- |
| `User` | `id String`, `email String`, `name String`, `role UserRole`, `passwordHash String`, `createdAt DateTime`, `updatedAt DateTime` |
| `FundingRound` | `id String`, `name String`, `description String?`, `opensAt DateTime`, `closesAt DateTime`, `createdAt DateTime`, `updatedAt DateTime` |
| `Application` | `id String`, `organizationName String`, `contactEmail String`, `requestedAmount Decimal(12,2)`, `submittedAt DateTime`, `status ApplicationStatus`, `archivedAt DateTime?`, `ownerId String`, `fundingRoundId String`, `createdAt DateTime`, `updatedAt DateTime` |
| `ReviewerAssignment` | `id String`, `applicationId String`, `reviewerId String`, `activeAssignmentKey String?`, `assignedAt DateTime`, `dueAt DateTime`, `completedAt DateTime?`, `removedAt DateTime?`, `createdAt DateTime`, `updatedAt DateTime` |
| `Review` | `id String`, `applicationId String`, `reviewerId String`, `assignmentId String`, `status ReviewStatus`, `impactScore Int?`, `feasibilityScore Int?`, `budgetJustificationScore Int?`, `comments String?`, `completedAt DateTime?`, `createdAt DateTime`, `updatedAt DateTime` |
| `ConflictOfInterest` | `id String`, `applicationId String`, `reviewerId String`, `activeConflictKey String?`, `reason String`, `declaredAt DateTime`, `resolvedAt DateTime?`, `createdAt DateTime`, `updatedAt DateTime` |
| `AuditEvent` | `id String`, `applicationId String`, `actorId String?`, `eventType String`, `metadata Json?`, `createdAt DateTime` |
| `OverdueAlert` | `id String`, `assignmentId String`, `dueAtSnapshot DateTime`, `triggeredAt DateTime`, `dismissedAt DateTime?`, `createdAt DateTime` |
| `FundingDecision` | `id String`, `applicationId String`, `decision FundingDecisionStatus`, `amountAwarded Decimal(12,2)?`, `notes String?`, `decidedById String`, `decidedAt DateTime`, `createdAt DateTime` |

Relation fields are intentionally excluded because they are Prisma relationship mappings, not separate persisted columns. Primary keys, unique fields, indexes, foreign keys, defaults, and deletion behavior are described above.

## Denormalization And Scale

There is no deliberate denormalized reporting table: dashboard, CSV, and calibration data derive from normalized application, assignment, review, and decision records. At 100x current data, in-memory reviewer calibration aggregation and broad discovery/report joins are the first likely pressure points. The current indexes cover common lookup paths; a larger system should move aggregate work into database aggregation/materialized reporting views, add query observability, and revisit pagination/index plans.

Reviewer calibration adds no model or migration. It reads completed `Review` scores and safe reviewer data, optionally constraining the associated `Application.fundingRoundId`.
