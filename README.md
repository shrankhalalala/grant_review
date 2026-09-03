# Grant Application Review System

This repository is being prepared for a take-home implementation of a Grant Application Review
System. The current state is intentionally limited to Phase 1: project initialization, structure,
and planning.

## Current status

Phase 1 establishes the repository layout and project documentation only. No application runtime,
package initialization, framework scaffolding, database configuration, or business logic has been
added yet.

## Repository structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
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

## Phase 1 goals

- Establish a clean root-level frontend/backend split
- Preserve assignment documentation and submission scaffolding
- Record initial architecture and planning decisions before implementation
- Keep the repository ready for incremental development in later phases

## Documentation

- `docs/plan.md` contains the full implementation roadmap across all phases
- `docs/architecture.md` captures the planned system shape before code exists
- `docs/decisions.md` records early project decisions and trade-offs
- `docs/schema.md` remains a schema-design placeholder until the data model is implemented
- `docs/ai-prompts.md` logs AI usage as work progresses

## Notes

- `SUBMISSION.md` has been preserved as-is for later completion.
- No `.git` directory exists in the extracted repository at this stage.
