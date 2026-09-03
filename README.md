# Grant Application Review System

This repository is being prepared for a take-home implementation of a Grant Application Review
System. Phases 1 through 6 are complete: project setup, backend foundation, database setup, authentication/authorization, application CRUD, and reviewer assignment.

## Current status

The repository now includes a minimal TypeScript, Node.js, and Express backend. It exposes
`GET /health`, uses centralized JSON error handling, and has a Vitest/Supertest testing foundation.
It also includes Prisma ORM, a Supabase-hosted PostgreSQL database, relational migrations, representative development seed data, and stateless JWT bearer authentication. Program Officers can create, list, retrieve, update, archive, and restore applications through protected APIs. Amounts use exact decimal strings, and application mutations record immutable audit events. Program Officers can also assign reviewers, update eligible assignment due dates, and soft-remove assignments; Reviewers can list only their own assignment history.

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
- A repository ready for incremental database and domain development in later phases

## Development demo login

All seeded Program Officer and Reviewer accounts use the development-only password `Demo123!`. For example, use `maya.officer@example.test` for a Program Officer or `ava.reviewer@example.test` for a Reviewer. These credentials are for local demonstration only and must not be used in production.

## Application API

Phase 5 application routes are Program Officer-only: `POST /applications`, `GET /applications`, `GET /applications/:id`, `PATCH /applications/:id`, `POST /applications/:id/archive`, and `POST /applications/:id/restore`. `requestedAmount` uses an exact decimal string such as `"1000.01"`; archive and restore change `archivedAt` rather than deleting the record.

## Assignment API

Program Officers manage `POST` and `GET /applications/:applicationId/assignments`, plus `PATCH` and `DELETE /assignments/:assignmentId`; Reviewers can use only `GET /reviewer/assignments`. A valid assignment moves a `SUBMITTED` application to `ASSIGNED` and records a status audit event. Archived and decided applications reject new assignments. Removal is historical via `removedAt`, does not change application status, and prevents further due-date edits; removed records remain visible in assignment lists.

## Documentation

- `docs/plan.md` contains the full implementation roadmap across all phases
- `docs/architecture.md` captures the current backend boundaries and planned system shape
- `docs/decisions.md` records project decisions and trade-offs
- `docs/schema.md` describes the implemented relational schema and its enforcement boundaries
- `docs/ai-prompts.md` logs AI usage as work progresses

## Notes

- `SUBMISSION.md` has been preserved as-is for later completion.
- Run `npm test` and `npm run build` from `backend/` to validate the current backend foundation.
