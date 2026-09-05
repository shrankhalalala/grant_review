# Design Decisions

## Separated Client, API, And Data Layers

The React client, Express API, and PostgreSQL database are independent deployable concerns. This keeps workflow rules server-side and fits Vercel, Render, and Supabase hosting.

## JWT With Server-Side Role Enforcement

The API verifies bcrypt password hashes, signs JWTs containing only identity and role, then protects every endpoint with authentication and role middleware. Client-side guards improve navigation but are not authorization.

## Historical Records Over Deletes

Applications archive with `archivedAt`; assignments soft-remove with `removedAt`; conflicts and alerts retain prior occurrences. Nullable active-pair keys preserve history while preventing duplicate active work.

## Service-Owned Lifecycle

Application state is not freely patchable. Assignment, first-review draft, explicit start-review, and funding-decision services perform valid transitions and append audit records transactionally.

## Dedicated Funding Decision

`DECIDED` is reachable only through a specific endpoint, for an unarchived `UNDER_REVIEW` application with at least three completed reviews. One decision per application is also database-enforced.

## Decimal API Contracts

Money is stored as `Decimal(12,2)` and serialized as two-decimal strings, avoiding floating-point ambiguity.

## Occurrence-Based Alerts

An alert is identified by assignment and due-date snapshot. Dismissal preserves history, while a later changed due date can generate a distinct alert. Active queries re-check actual assignment state.

## UI Freshness Guards

Selection and timeline requests have identity/version protections. Deterministic deferred-promise tests prove stale responses cannot overwrite current UI state.

## Configuration Outside Source

Secrets are private deployment values. Vite receives the public API origin during build; Render receives the backend CORS origin and private runtime values. A small Vercel rewrite enables SPA routing without changing application routes.

## Reversed Hosting Decision

An early hosted PostgreSQL direction considered Neon. Connection attempts documented in the project prompt record did not succeed in the development network, so the final hosted database is Supabase PostgreSQL. Prisma and the relational schema stayed the same; only the managed host changed. Supabase Auth was explicitly rejected because the existing backend JWT model already owned authentication and authorization.

## Calibration Instead Of Higher-Risk Stretch Work

Reviewer calibration was chosen because completed Review data already supports it, it adds analytical value without a new workflow or authentication model, and it needs no migration. Applicant portals, email notifications, configurable rubrics, and automatic reviewer matching were deferred because each would substantially expand domain and infrastructure complexity.
