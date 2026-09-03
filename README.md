# Grant Application Review System

This repository is being prepared for a take-home implementation of a Grant Application Review
System. Phases 1 through 3 are complete: project setup, backend foundation, and database setup.

## Current status

The repository now includes a minimal TypeScript, Node.js, and Express backend. It exposes
`GET /health`, uses centralized JSON error handling, and has a Vitest/Supertest testing foundation.
It also includes Prisma ORM, a Supabase-hosted PostgreSQL database, the initial relational migration,
and representative development seed data. Authentication and domain APIs have not been implemented.

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

## Documentation

- `docs/plan.md` contains the full implementation roadmap across all phases
- `docs/architecture.md` captures the current backend boundaries and planned system shape
- `docs/decisions.md` records project decisions and trade-offs
- `docs/schema.md` describes the implemented relational schema and its enforcement boundaries
- `docs/ai-prompts.md` logs AI usage as work progresses

## Notes

- `SUBMISSION.md` has been preserved as-is for later completion.
- Run `npm test` and `npm run build` from `backend/` to validate the current backend foundation.
