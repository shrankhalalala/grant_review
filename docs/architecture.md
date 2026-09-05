# Architecture

## Deployed System

```text
React/Vite browser client
  -> Vercel static hosting and SPA rewrite
  -> Express JSON API on Render
  -> Prisma ORM
  -> Supabase-hosted PostgreSQL
```

The frontend sends JSON over HTTPS with bearer JWTs. Vercel rewrites direct browser routes to `index.html` so React Router can resolve them. The backend CORS origin comes from `FRONTEND_URL`.

## Frontend

`frontend/` is a TypeScript React/Vite SPA. React Router separates Program Officer and Reviewer routes, while `AuthProvider` restores an existing token through `GET /auth/me`. A shared typed API client adds authorization headers and turns API failures into consistent UI errors.

Program Officer views include the dashboard, application discovery/detail, assignments, alerts, reports, CSV export, and bulk assignment. Reviewer views include personal assignments, conflict declarations, drafts, and review completion. A theme provider persists light/dark preference with a system-theme fallback, and authenticated shells provide responsive collapsible navigation.

Detail and timeline state use request identity/version guards. A delayed response for an old selection or refresh cannot overwrite newer rendered state.

## Backend

`backend/src/app.ts` configures JSON parsing, CORS, route registration, JSON 404 behavior, and centralized error handling. `server.ts` only starts the listener. Routes are thin; controllers validate HTTP input and services own Prisma access, domain rules, transactions, safe projections, and audit writes.

Authentication verifies bcrypt password hashes and signs JWTs containing only user ID and role. Middleware validates each protected bearer token, then role middleware applies Program Officer or Reviewer access. The API does not trust frontend route visibility for authorization.

`GET /health` returns `{ "status": "ok" }` without database work for platform monitoring.

## Data And Operations

Prisma maps relational models and migrations to PostgreSQL. Runtime uses pooled `DATABASE_URL`; Prisma CLI migration and seed commands use `DIRECT_URL`. Supabase is PostgreSQL hosting only; Supabase Auth, Storage, and Edge Functions are not used.

Cross-record workflow writes are transactional: assignments with status/audit events, reviews with lifecycle/audit events, decisions with application/audit events, and archive/restore with audit events. The development seed deletes and recreates demo data, so it is for disposable local environments only.

The optional calibration read flow uses the existing Program Officer Reports page to request completed-review aggregates from `GET /reviewers/calibration`, optionally scoped by funding round. It is a read-only derived report over existing review, assignment, and application relationships.

## Representative Flow

1. A Program Officer selects a reviewer in the Vercel-hosted React application.
2. The typed client sends `POST /applications/:applicationId/assignments` to Render with a bearer token.
3. Authentication validates the JWT and role middleware requires `PROGRAM_OFFICER`.
4. The assignment service checks the application state, active duplicate, unresolved conflict, and five-active-assignment limit.
5. Prisma writes the assignment, any `SUBMITTED -> ASSIGNED` transition, and audit event in one PostgreSQL transaction.
6. The API returns a safe assignment projection and the frontend refreshes the selected application.

## Runtime Locations

- Browser: React/TypeScript/Vite UI and React Router state.
- Vercel: static frontend build and SPA fallback rewrite.
- Render: Express REST API, authentication, authorization, workflow services, and CORS enforcement.
- Supabase: managed PostgreSQL database; Prisma is the API's data-access layer.

## Deliberately Not Built

This take-home does not include applicant self-service, email delivery, background queues or cron jobs, configurable rubrics, automatic reviewer matching, refresh-token revocation, production account provisioning, or Supabase Auth/Storage/Edge Functions.

## Deployment

Vercel receives `VITE_API_BASE_URL` during the frontend build. Render receives private database, JWT, CORS, and production environment values, generates Prisma client code, applies migrations, builds the API, and runs `npm start`.
