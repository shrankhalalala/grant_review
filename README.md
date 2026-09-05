# Grant Application Review System

A full-stack take-home application for managing grant applications from submission through reviewer assignment, scoring, funding decisions, and audit history.

## Live Demo

- Application: [grantreview-kohl.vercel.app](https://grantreview-kohl.vercel.app)
- API: [grant-review.onrender.com](https://grant-review.onrender.com)
- API health: [grant-review.onrender.com/health](https://grant-review.onrender.com/health)

The Render service can take a short time to wake after inactivity. Vercel is configured for React Router direct-route refreshes.

| Role | Email | Password |
| --- | --- | --- |
| Program Officer | `maya.officer@example.test` | `Demo123!` |
| Reviewer | `ava.reviewer@example.test` | `Demo123!` |

The login page's evaluator selectors fill these public development credentials but retain the normal authentication flow.

## Capabilities

- Program Officer application creation, discovery, filters, sorting, pagination, archiving, restoration, and detail workflows.
- Reviewer assignment, due-date management, five-active-assignment capacity protection, conflict checks, and bulk assignment.
- Reviewer-owned draft and completed scored reviews, plus conflict declarations.
- Dedicated funding decisions after three completed reviews; append-only timeline events and comments.
- Overdue alerts, dashboard metrics, funding-round reporting, and safe completed-review CSV export.
- Server-enforced roles, responsive navigation, persistent light/dark theme, and stale-response protections.

## Architecture

```text
React/Vite browser -> Vercel SPA -> Render Express API -> Prisma -> Supabase PostgreSQL
```

The browser sends JSON with bearer JWTs. Express owns validation, authorization, domain transitions, and audit writes. Prisma uses `DATABASE_URL` at runtime; Prisma CLI uses `DIRECT_URL` for migrations and seeding. See [architecture details](docs/architecture.md) and the [schema reference](docs/schema.md).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [React Router](https://reactrouter.com/) |
| Backend | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), TypeScript |
| Data | [Prisma](https://www.prisma.io/) with [PostgreSQL](https://www.postgresql.org/) |
| Security | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) and [JWT](https://jwt.io/) |
| Testing | [Vitest](https://vitest.dev/), React Testing Library, [Supertest](https://github.com/forwardemail/supertest) |
| Hosting | [Vercel](https://vercel.com/), [Render](https://render.com/), [Supabase](https://supabase.com/) |

## Repository Layout

```text
backend/    Express API, Prisma schema/migrations, seed, and API tests
frontend/   React/Vite SPA and UI tests
docs/       Architecture, schema, decisions, plan, and AI-use notes
```

## Run Locally

Prerequisites: Node.js 20+ and PostgreSQL. Copy `backend/.env.example` to `backend/.env`, replace all placeholders, and never commit it.

```bash
# Terminal 1
cd backend
npm install
npm run db:generate
npx prisma migrate deploy
npm run db:seed  # development only; resets and recreates demo data
npm run dev
```

```bash
# Terminal 2
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

| Backend variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL URL used by the API. |
| `DIRECT_URL` | Direct PostgreSQL URL for Prisma migration/seed operations. |
| `JWT_SECRET` | Private random secret of at least 32 characters. |
| `JWT_EXPIRES_IN` | Token duration, for example `1h`. |
| `FRONTEND_URL` | Exact frontend CORS origin. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PORT` | Optional API port; defaults to `4000`. |

The frontend requires `VITE_API_BASE_URL` for production builds; development defaults to `http://localhost:4000`.

## Validate

```bash
cd backend && npm test && npm run build
cd frontend && npm test
VITE_API_BASE_URL=https://grant-review.onrender.com npm run build
```

In constrained sandboxes, Supertest may be blocked from opening its listener with `listen EPERM`; run backend tests in an unrestricted local or CI environment in that case.

## Deploy

### Render API

- Root: `backend`
- Build: `npm ci --include=dev && npm run db:generate && npx prisma migrate deploy && npm run build`
- Start: `npm start`
- Health check: `/health`
- Private variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, and `NODE_ENV=production`.

### Vercel Frontend

- Root: `frontend`
- Build: `npm run build`
- Output: `dist`
- Build variable: `VITE_API_BASE_URL=https://grant-review.onrender.com`
- `frontend/vercel.json` rewrites browser paths to `index.html`.

## Further Reading

- [Architecture](docs/architecture.md)
- [Schema](docs/schema.md)
- [Implementation plan](docs/plan.md)
- [Design decisions](docs/decisions.md)
- [AI-use notes](docs/ai-prompts.md)
- [Submission guide](SUBMISSION.md)
