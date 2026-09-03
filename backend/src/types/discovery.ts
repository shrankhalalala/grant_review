import type { ApplicationStatus } from "@prisma/client";

export type ApplicationSortField = "submittedAt" | "requestedAmount" | "status";
export type SortDirection = "asc" | "desc";

export interface ApplicationDiscoveryInput {
  search?: string;
  fundingRoundId?: string;
  status?: ApplicationStatus;
  ownerId?: string;
  overdue?: boolean;
  sortBy: ApplicationSortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

export interface BulkAssignmentInput {
  reviewerIds: string[];
  dueAt: Date;
}
