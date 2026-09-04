export type ApplicationStatus = "SUBMITTED" | "ASSIGNED" | "UNDER_REVIEW" | "DECIDED";
export type FundingDecisionStatus = "APPROVED" | "DECLINED";

export interface FundingRoundSummary {
  id: string;
  name: string;
  opensAt: string;
  closesAt: string;
}

export interface Application {
  id: string;
  organizationName: string;
  contactEmail: string;
  fundingRoundId: string;
  requestedAmount: string;
  submittedAt: string;
  status: ApplicationStatus;
  archivedAt: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  fundingRound: FundingRoundSummary;
  owner: { id: string; name: string; email: string; role: string };
  reviews: Array<{
    id: string;
    impactScore: number | null;
    feasibilityScore: number | null;
    budgetJustificationScore: number | null;
    comments: string | null;
    completedAt: string | null;
    reviewer: { id: string; name: string };
  }>;
  fundingDecision: { id: string; decision: FundingDecisionStatus; decidedAt: string; notes: string | null; decidedBy: { id: string; name: string } } | null;
}

export interface ApplicationInput {
  organizationName: string;
  contactEmail: string;
  fundingRoundId: string;
  requestedAmount: string;
  submittedAt: string;
}

export type ApplicationUpdateInput = Partial<ApplicationInput>;
export type ApplicationSortField = "submittedAt" | "requestedAmount" | "status";

export interface ApplicationDiscovery {
  search?: string;
  fundingRoundId?: string;
  status?: ApplicationStatus;
  ownerId?: string;
  overdue?: boolean;
  sortBy: ApplicationSortField;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface ApplicationListResponse {
  applications: Application[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TimelineEvent {
  id: string;
  applicationId: string;
  actorId: string | null;
  eventType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}
