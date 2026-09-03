# Grant Application Review System

This repository is being prepared for a take-home implementation of a Grant Application Review
System. Phase 1 project setup and the Phase 2 backend foundation are complete.

## Current status

The repository now includes a minimal TypeScript, Node.js, and Express backend. It exposes
`GET /health`, uses centralized JSON error handling, and has a Vitest/Supertest testing foundation.
Database configuration, authentication, and domain functionality have not been implemented.

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
- `docs/schema.md` remains a schema-design placeholder until the data model is implemented
- `docs/ai-prompts.md` logs AI usage as work progresses

## Notes

- `SUBMISSION.md` has been preserved as-is for later completion.
- Run `npm test` and `npm run build` from `backend/` to validate the current backend foundation.
