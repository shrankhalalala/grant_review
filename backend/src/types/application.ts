export interface ApplicationInput {
  organizationName: string;
  contactEmail: string;
  fundingRoundId: string;
  requestedAmount: string;
  submittedAt: Date;
}

export interface ApplicationUpdateInput {
  organizationName?: string;
  contactEmail?: string;
  fundingRoundId?: string;
  requestedAmount?: string;
  submittedAt?: Date;
}
