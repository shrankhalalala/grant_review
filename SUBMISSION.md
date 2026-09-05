# Grant Application Review System Submission

## Links

- Repository: [github.com/shrankhalalala/grant_review](https://github.com/shrankhalalala/grant_review)
- Live application: [grantreview-kohl.vercel.app](https://grantreview-kohl.vercel.app)
- API health: [grant-review.onrender.com/health](https://grant-review.onrender.com/health)

The Render API can cold-start after inactivity. Vercel direct links are supported by the SPA rewrite.

## Notes For The Reviewer

The backend is hosted on Render's free tier and may spin down after inactivity. The first request after an idle period can take around a minute while the service wakes; subsequent requests should respond normally.

## Demo Credentials

| Role | Email | Password |
| --- | --- | --- |
| Program Officer | `maya.officer@example.test` | `Demo123!` |
| Reviewer | `ava.reviewer@example.test` | `Demo123!` |

The login page includes selectors that fill these evaluation credentials while preserving normal login submission.

## 10-Goal Checklist

| Area | How to verify | Notes |
| --- | --- | --- |
| Authentication and roles | Sign in with both accounts. | Role access is server-authorized and client-guarded. |
| Application management | Use Program Officer Applications. | Create/edit/archive/restore, search, filter, sort, paginate, and inspect. |
| Reviewer assignment | Open an application detail. | Assignment rejects active duplicates, conflicts, invalid state, and workload above five. |
| Reviewer workflow | Sign in as Reviewer and open Assignments. | Save drafts, declare conflicts, and complete three 1–5 scores. |
| Lifecycle and decisions | Return as Program Officer. | Start review when assigned; decision requires three completed reviews. |
| Timeline and comments | Open application timeline. | Events are append-only; comments are unavailable for archived applications. |
| Dashboard and alerts | Open Dashboard and Alerts. | Dashboard aggregates work; alerts show overdue incomplete assignments. |
| Reports and bulk assignment | Open Reports. | Choose a funding round for completed-review CSV or bulk assignment. |
| UI resilience | Switch applications while content loads. | Freshness guards prevent stale response overwrites. |
| Navigation and theme | Use sidebar and theme controls. | Navigation is responsive/collapsible; preference persists. |

## Actual Time Spent

Exact hours were not recorded reliably in the repository, so this submission does not invent a number. The Git history records the implementation work across September 3–5, 2026.

## With Another 12 Hours

I would add end-to-end browser coverage and accessibility review, session revocation/account provisioning, database-level score checks, reviewer-capacity concurrency protection, and production observability.

## Least Happy With

The compact Reports page carries several related tools in one screen. It is effective for the take-home scope, but a larger product would benefit from more deliberate information hierarchy and an end-to-end workflow test suite around those interactions.

## Stack

| Layer | Implementation |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router on Vercel. |
| Backend | TypeScript/Express with JWT authentication on Render. |
| Database | Prisma with Supabase PostgreSQL. |
| Testing | Vitest, React Testing Library, and Supertest. |

## Optional Stretch Feature

Program Officers can open **Reports** to view Reviewer Calibration. It aggregates completed reviews only, showing criterion averages, an overall benchmark and reviewer difference, and optional funding-round scope. Reviewers with fewer than three completed reviews are labelled **Limited data**; otherwise a difference of at least 0.5 is described as more lenient or more stringent. It describes scoring tendency, not reviewer quality.

## Local Run

1. Copy `backend/.env.example` to `backend/.env` and replace private placeholders.
2. In `backend/`, run `npm install`, `npm run db:generate`, `npx prisma migrate deploy`, `npm run db:seed` (development only), then `npm run dev`.
3. In `frontend/`, run `npm install` and `npm run dev`.

The seed deletes and recreates development data; do not routinely run it against production.

## Deployment Notes

```bash
npm ci --include=dev && npm run db:generate && npx prisma migrate deploy && npm run build
```

Render starts with `npm start` and checks `/health`. Configure `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, and `NODE_ENV=production` privately in Render. Configure `VITE_API_BASE_URL=https://grant-review.onrender.com` in Vercel. No secret values are stored in this repository.

## Trade-offs And Next Steps

The submission prioritizes server-enforced workflow rules, auditability, and deterministic UI behavior. With more time, I would add refresh-token revocation, production account provisioning, database-level score checks, concurrency protection for reviewer capacity, CI/observability, accessibility review, and end-to-end browser coverage.
