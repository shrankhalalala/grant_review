# Grant Application Review System

This repository is being prepared for a take-home implementation of a Grant Application Review
System. Phases 1 through 8 are complete: project setup, backend foundation, database setup, authentication/authorization, application CRUD, reviewer assignment, review workflow, and application lifecycle with funding decisions.

## Current status

The repository now includes a TypeScript, Node.js, and Express backend with centralized JSON error
handling, a Vitest/Supertest testing foundation, Prisma ORM, and a Supabase-hosted PostgreSQL
database. It implements stateless JWT bearer authentication plus protected workflows for Program
Officer application management, reviewer assignment, reviewer draft and completed reviews, explicit
application lifecycle movement into `UNDER_REVIEW`, and final funding decisions once review
requirements are met. Amounts use exact decimal strings, archived records stay retrievable, and
workflow mutations record immutable audit events.

## Repository structure

```text
.
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   ├── prisma/
│   ├── prisma.config.ts
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── services/
│       ├── types/
│       └── utils/
├── docs/
│   ├── ai-prompts.md
│   ├── architecture.md
│   ├── decisions.md
│   ├── plan.md
│   └── schema.md
├── .gitignore
├── README.md
└── SUBMISSION.md
```

## Current foundation

- A clean root-level frontend/backend split
- A TypeScript and Express backend with a testable application/server boundary
- Centralized environment configuration, JSON error handling, and a health endpoint
- Implemented database, authentication, application, assignment, review, and decision workflows

## Development demo login

All seeded Program Officer and Reviewer accounts use the development-only password `Demo123!`. For example, use `maya.officer@example.test` for a Program Officer or `ava.reviewer@example.test` for a Reviewer. These credentials are for local demonstration only and must not be used in production.

## Application API

Phase 5 application routes are Program Officer-only: `POST /applications`, `GET /applications`, `GET /applications/:id`, `PATCH /applications/:id`, `POST /applications/:id/archive`, and `POST /applications/:id/restore`. `requestedAmount` uses an exact decimal string such as `"1000.01"`; archive and restore change `archivedAt` rather than deleting the record.

## Assignment API

Program Officers manage `POST` and `GET /applications/:applicationId/assignments`, plus `PATCH` and `DELETE /assignments/:assignmentId`; Reviewers can use only `GET /reviewer/assignments`. A valid assignment moves a `SUBMITTED` application to `ASSIGNED` and records a status audit event. Archived and decided applications reject new assignments. Removal is historical via `removedAt`, does not change application status, and prevents further due-date edits; removed records remain visible in assignment lists.

## Review API

Reviewers create and retrieve their own drafts at `POST` and `GET /assignments/:assignmentId/review`, edit drafts with `PATCH /reviews/:reviewId`, complete them through `POST /reviews/:reviewId/complete`, and declare assigned-work conflicts through `POST /assignments/:assignmentId/conflict`. Draft scores are optional but must be integer values from 1 to 5 when provided. First draft creation moves `ASSIGNED` applications to `UNDER_REVIEW`; completed reviews are immutable and appear, without drafts, in Program Officer application detail.

## Lifecycle And Decision API

Program Officers can explicitly move an assigned application into active review with `POST /applications/:id/status` and `{ "status": "UNDER_REVIEW" }`. The generic status route cannot set `DECIDED`, archived applications reject lifecycle mutation, and the existing automatic Phase 7 transition on first draft creation remains valid.

Final decisions use the dedicated `POST /applications/:id/decision` route with `{ "decision": "APPROVED" }` or `{ "decision": "DECLINED" }`. A decision is allowed only from `UNDER_REVIEW`, requires at least three completed reviews, excludes drafts from the threshold, writes transactional lifecycle and decision audit events, and creates one immutable `FundingDecision` record per application. Application detail returns this record as `fundingDecision`, or `null` when undecided.

## Timeline And Alerts API

Program Officers can retrieve append-only application history at `GET /applications/:applicationId/timeline` and add immutable informational comments at `POST /applications/:applicationId/comments`. Comments are blocked for archived applications and remain allowed after a decision. `GET /alerts/overdue`, `GET /alerts/overdue/count`, and `POST /alerts/overdue/:alertId/dismiss` provide active overdue-review alerts, a navigation-badge count, and idempotent dismissal. Alerts are retained historically and each assignment due-date occurrence can create only one alert.

## Documentation

- `docs/plan.md` contains the full implementation roadmap across all phases
- `docs/architecture.md` captures the current backend boundaries and planned system shape
- `docs/decisions.md` records project decisions and trade-offs
- `docs/schema.md` describes the implemented relational schema and its enforcement boundaries
- `docs/ai-prompts.md` logs AI usage as work progresses

## Notes

- `SUBMISSION.md` has been preserved as-is for later completion.
- Run `npm test` and `npm run build` from `backend/` to validate the current backend implementation.
