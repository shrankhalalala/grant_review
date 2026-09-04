# Architecture

This document captures the system shape and its current implementation boundaries. The backend
foundation, database persistence, authentication, application workflows, reviewer assignment,
review workflow, and funding-decision lifecycle are now implemented; frontend work and later
reporting and alerting phases remain planned.

## Phase 2 backend foundation

The backend is a Node.js application written in TypeScript and served through Express.

- `backend/src/app.ts` configures and exports the Express application. It registers JSON parsing,
  CORS, routes, JSON 404 handling, and centralized error handling without opening a network port.
- `backend/src/server.ts` imports the configured application and starts the HTTP server on the port
  defined by `backend/src/config/env.ts`.
- `backend/src/routes/` owns HTTP route registration. The current `GET /health` endpoint confirms
  that the backend process is responsive without depending on a database.
- `backend/src/middleware/` owns cross-cutting HTTP behavior, currently JSON 404 and error responses.
- `backend/src/config/` centralizes environment loading and basic validation so application code does
  not repeatedly read environment variables.

Vitest and Supertest test the exported Express application directly. This keeps tests fast and avoids
starting a separate HTTP server. As domain features are introduced, route definitions should remain
thin and services will own the application business logic.

## Phase 3 persistence foundation

The persistence path is now:

Frontend
  -> Express API
  -> Prisma
  -> Supabase-hosted PostgreSQL

Prisma is the typed data-access and migration layer. Supabase is used only to host the PostgreSQL
database; Supabase Auth, Storage, Edge Functions, and other Supabase services are not part of this
architecture. The initial migration has been applied and the development seed data has been inserted.
Application, assignment, review, and funding-decision routes now query and mutate the database
through Prisma services. Prisma 7 reads `DIRECT_URL` from `backend/prisma.config.ts` for CLI and
migration operations; runtime database work uses the pooled `DATABASE_URL` through the backend
configuration helper.

The schema contains relational models, bcrypt password hashes, and seed data. Application CRUD,
assignment workflow, review workflow, and funding decisions all use this existing schema without
adding a Phase 8 migration.

## Phase 4 authentication and authorization

`POST /auth/login` validates an email/password pair against the server-side `User.passwordHash` value and returns a signed JWT plus a safe user profile. The JWT contains only `userId` and `role`; it does not contain credentials or profile data. `GET /auth/me` requires a valid bearer token and reloads a safe profile from the database.

The authentication middleware verifies the JWT signature before attaching identity to the request. Reusable role middleware then enforces Program Officer and Reviewer access on the server. This keeps authorization independent of client-side UI decisions. Access tokens are stateless for the current scope; refresh tokens, cookies, OAuth, and account-management flows are deliberately deferred.

## Phase 5 application CRUD

All `/applications` routes require a valid bearer token and the `PROGRAM_OFFICER` role. Controllers validate input and delegate persistence to the application service. Creation derives the owner from the authenticated identity; general updates cannot change ownership, archive state, or lifecycle status.

Requested amounts are accepted and returned as decimal strings. The service constructs `Prisma.Decimal` values directly, avoiding JavaScript floating-point conversion, and serializes database decimals with two fractional digits. Archive and restore update only `archivedAt`, retaining related records and lifecycle status. Creation, update, archive, and restore each write an append-only `AuditEvent` within the same transaction.

## Phase 6 reviewer assignment

Program Officers manage application assignments and Reviewers can list only their own assignments. Assignment creation rejects archived and decided applications, duplicate active assignments, unresolved conflicts, and reviewers with five active assignments. A successful assignment moves an application from `SUBMITTED` to `ASSIGNED` within the same transaction and records a status audit event; `ASSIGNED` and `UNDER_REVIEW` are not changed. Removal is a soft change that preserves history and never regresses application status. Removed assignments remain visible in both assignment lists, but cannot have their due date changed; completed reviews also lock due-date changes and removal. Assignment mutations write transactional audit events. The workload count is server-side but does not introduce database locking for concurrent assignment requests.

## Phase 7 review workflow

Reviewer-only routes derive identity from the JWT and verify assignment or review ownership in the service layer. Drafts support nullable 1–5 integer criterion scores and comments; completion is a dedicated immutable transition requiring all scores. The first draft on an `ASSIGNED` application moves it to `UNDER_REVIEW` with an audit event. Archived, decided, removed, conflicted, and cross-reviewer work is rejected. Conflict declarations preserve assignments and drafts but block review mutations. All review mutations and their audit events are transactional. Application detail exposes completed reviews with safe reviewer identity only; drafts remain private.

Review uniqueness is per assignment, so a historical soft-removed assignment retains its review while a later reassignment can receive a separate review.

## Phase 8 application lifecycle and funding decisions

Program Officers have two distinct lifecycle controls. `POST /applications/:id/status` supports only the explicit `ASSIGNED` to `UNDER_REVIEW` transition, preserving the assignment requirement that officers can actively start the review stage when needed. Its transaction uses a conditional current-state update, so competing lifecycle requests cannot both create a transition audit event. The existing Phase 7 first-draft transition remains compatible because it targets the same destination and still writes the same class of status audit event.

`DECIDED` is intentionally unreachable through the generic status route. Finalization uses `POST /applications/:id/decision`, which validates that the application is currently `UNDER_REVIEW`, is not archived, has no prior funding decision, and has at least three completed reviews. Draft reviews are excluded from that count. The service performs the decision insert, application status change, and both audit events in one transaction. The database uniqueness guard remains authoritative for races and its duplicate-decision violation is translated to a controlled conflict response.

Application detail now projects a singular `fundingDecision` object when present and `null` otherwise. The decision actor is narrowed to safe identity fields so `passwordHash` and other internal user data cannot leak through the serializer.

## Phase 9 timeline comments and overdue alerts

Program Officers retrieve application history through append-only `AuditEvent` rows, ordered by creation timestamp and event id. Application comments are immutable `APPLICATION_COMMENT_ADDED` audit events, blocked for archived applications but allowed for decided applications as informational notes. There are no audit-event edit or delete routes.

Overdue synchronization finds incomplete, unremoved assignments whose due date has passed. An alert occurrence is uniquely identified by assignment and due-date snapshot, so dismissing an alert retains history without suppressing a later due-date occurrence. Active list and badge queries re-check the current assignment, review, and due-date state, excluding completed, removed, dismissed, and superseded occurrences.

## Phase 10 discovery, bulk assignment, and export

Program Officers can query `GET /applications` with validated search, funding-round, status, owner,
and overdue filters, deterministic sorting, pagination, and a total count. Overdue application filters
use the same active, incomplete, past-due assignment definition as alert synchronization. Bulk assignment
accepts a funding round, reviewers, and one due date, then calls the existing assignment service for
every application/reviewer pair so conflicts, active-duplicate checks, capacity, and lifecycle rules
remain authoritative. `GET /funding-rounds/:fundingRoundId/reviews/export.csv` returns only completed
reviews with separate criterion columns and CSV-safe escaping.

## Phase 11 dashboard

`GET /dashboard` is a Program Officer-only read endpoint served by a dedicated route, controller,
and service. It aggregates existing application, assignment, review, funding-round, and
funding-decision data without a dashboard table. The response includes lifecycle counts, the
existing active-incomplete overdue definition, a Decimal-formatted monthly requested total,
funding-round counts, and eight Monday-start UTC decision-week buckets.

## Planned moving pieces

- A frontend application responsible for authentication flows, role-based screens, forms, tables,
  dashboards, and review workflows
- A backend API responsible for authentication, authorization, business rules, workflow validation,
  reviewer assignment logic, alerts, search, exports, and audit history
- A PostgreSQL database for persistent storage of users, applications, assignments, reviews, status
  transitions, alerts, and audit events

## Planned communication model

- The frontend will communicate with the backend over HTTP APIs
- The backend will enforce permissions and workflow rules on the server
- The backend will persist and query application data through a relational database layer

## Planned runtime locations

- Frontend: browser-delivered web application
- Backend: server-side application process
- Database: managed PostgreSQL instance

## Representative request path

One representative user action will be reviewer assignment:

1. A program officer selects one or more reviewers for an application in the frontend
2. The frontend sends the assignment request to the backend API
3. The backend authenticates the caller and verifies the program officer role
4. The backend validates business rules such as conflict declarations and active assignment limits
5. The backend persists successful assignments and records audit events
6. The backend returns per-assignment success or refusal details
7. The frontend updates the application view and displays the result summary

## Early architectural direction

- Keep frontend and backend separated from the start to maintain clear ownership of UI and business
  logic
- Enforce all role and workflow rules on the backend rather than relying on frontend hiding
- Use a relational data model because the domain centers on explicit relationships, constraints, and
  auditable lifecycle events
- Treat audit history as append-only domain data rather than derived UI metadata

## Not yet implemented

- No audit-history retrieval or overdue-alert workflow routes yet
- No dashboard endpoints yet
- No frontend implementation or deployment configuration yet

Those concerns remain intentionally deferred to later phases to keep each increment focused.
