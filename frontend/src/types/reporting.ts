import type { ReviewerAssignment } from "./assignment";
export type BulkAssignmentResult = { applicationId: string; reviewerId: string; success: true; assignment: ReviewerAssignment } | { applicationId: string; reviewerId: string; success: false; reason: string };
