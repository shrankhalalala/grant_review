# Implementation Plan

## Phase 1 — Project Initialization
- Establish repository structure
- Separate frontend and backend
- Establish documentation structure
- Record initial architectural decisions

## Phase 2 — Backend Foundation (Complete)
- Initialize TypeScript backend
- Configure application entry point
- Environment configuration
- Error handling
- Health check
- Backend testing foundation

## Phase 3 — Database (Complete)
- Select and configure PostgreSQL
- Configure Prisma
- Design relational schema
- Create migrations
- Create seed/demo data

## Phase 4 — Authentication and Authorization (Complete)
- User authentication
- Program Officer role
- Reviewer role
- Server-side authorization
- Protected API routes

## Phase 5 — Grant Applications (Complete)
- Funding rounds
- Application creation
- Application editing
- Application archive/restore
- Application ownership

## Phase 6 — Reviewer Assignment (Complete)
- Reviewer assignment
- Reviewer workload limits
- Conflict-of-interest handling
- Due dates
- Assignment removal
- First-assignment `SUBMITTED` to `ASSIGNED` transition with audit history

## Phase 7 — Review Workflow (Complete)
- Review creation
- Draft reviews
- Review scoring
- Review comments
- Review completion
- Review immutability

## Phase 8 — Application Lifecycle (Complete)
- Application status transitions
- Server-side transition validation
- Explicit Program Officer `ASSIGNED` to `UNDER_REVIEW` control
- Compatibility with the automatic first-draft `UNDER_REVIEW` transition
- Three-completed-review requirement
- Draft exclusion from the decision threshold
- Dedicated funding decisions

## Phase 9 — Audit History and Alerts (Complete)
- Immutable application history
- Audit events
- Overdue review detection
- Alert dismissal
- Alert reappearance after due-date changes

## Phase 10 — Search, Filtering and Reporting (Complete)
- Server-side search
- Filtering
- Sorting
- Pagination
- Bulk reviewer assignment
- CSV export

## Phase 11 — Dashboard
- Application statistics
- Review statistics
- Overdue statistics
- Funding-round statistics
- Decision trends

## Phase 12 — Frontend
- Authentication UI
- Program Officer interface
- Reviewer interface
- Application management
- Reviewer management
- Review interface
- Dashboard
- Alerts

## Phase 13 — Testing and Validation
- Unit tests
- API tests
- Authorization tests
- Business-rule tests
- Workflow tests
- Edge cases

## Phase 14 — Deployment
- Production environment configuration
- Hosted PostgreSQL
- Backend deployment on Render
- Frontend deployment
- CORS configuration
- Production smoke testing

## Phase 15 — Documentation and Submission
- README
- Architecture documentation
- Schema documentation
- Technical decisions
- AI development log
- Demo credentials
- SUBMISSION.md
- Final deployment verification
