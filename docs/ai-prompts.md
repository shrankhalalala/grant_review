# AI-Assisted Development Notes

AI assistance was used as a collaborative coding aid: to inspect the repository, implement scoped changes, write focused tests, identify stale asynchronous UI risks, and reconcile documentation with the implementation. The developer retained responsibility for requirements, review, validation, visual approval, and final choices.

## Representative Use

- Incremental prompts for backend workflows, frontend integration, tests, reviews, and narrowly scoped fixes.
- Read-only reviews focused on authorization, lifecycle constraints, safe response projections, async state ownership, and regression-test quality.
- Deployment and documentation prompts validated against actual scripts, environment ownership, Vercel SPA behavior, and Render settings.

## Validation Baseline

- Frontend tests: 81 passing across 10 files.
- Frontend production build: passing with `VITE_API_BASE_URL=https://grant-review.onrender.com`.
- Backend build: passing.
- Backend tests: valid outside restrictive sandboxes; Supertest can be blocked by local-listener `EPERM` in constrained environments.
- `git diff --check`: passing before this documentation pass.

AI output was treated as a draft subject to code inspection and test validation, not as independent authority.
