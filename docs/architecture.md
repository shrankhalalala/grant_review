# Architecture

This document captures the system shape and its current implementation boundaries. Phase 2 adds the
backend foundation; database, authentication, and domain functionality remain planned work.

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

- No database schema or migrations yet
- No authentication implementation yet
- No grant application, reviewer assignment, or review workflows yet
- No deployment configuration yet

Those concerns remain intentionally deferred to later phases so the foundation can stay focused.
