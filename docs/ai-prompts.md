# AI prompts

The prompts below reflect actual AI-assisted work performed so far on this repository.

## Complete Phase 1 repository initialization

### Prompt

Complete only Phase 1 of the Grant Application Review System take-home. Inspect the current
repository first, preserve `SUBMISSION.md`, create the requested frontend/backend directory
structure, populate `docs/plan.md` with the provided phase roadmap, and avoid initializing the
application itself.

### What you got

An implementation pass that first audited the repository contents, confirmed there was no remaining
application scaffolding, created the empty directory structure, and updated the planning and setup
documentation.

### What you corrected

The first instinct would have been to start generating application scaffolding or select a concrete
stack too early. That was intentionally avoided after re-checking the assignment constraints, because
Phase 1 is limited to structure and documentation only.

## Complete Phase 2 backend foundation

### Prompt

Build only the backend foundation for the Grant Application Review System: initialize a TypeScript,
Node.js, and Express backend; separate app configuration from server startup; centralize environment
configuration; implement a health route and JSON error handling; and establish Vitest/Supertest tests.

### What you got

A minimal Express backend with `app.ts` exporting the testable application, `server.ts` owning the
listener, validated environment configuration, `GET /health`, JSON 404 and error responses, and an
application-level health test suite.

### What you corrected

The initial test run was blocked by the restricted workspace sandbox, which does not permit Supertest
to open its temporary local listener. Re-running the same tests with local network permission resolved
the environment restriction. The work intentionally stopped at the HTTP and testing foundation;
database, authentication, and domain logic remain outside the scope.
