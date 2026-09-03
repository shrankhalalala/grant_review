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
