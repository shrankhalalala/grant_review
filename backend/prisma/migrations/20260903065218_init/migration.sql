-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROGRAM_OFFICER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'DECIDED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FundingDecisionStatus" AS ENUM ('APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "requestedAmount" DECIMAL(12,2) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "archivedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "fundingRoundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerAssignment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "activeAssignmentKey" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "impactScore" INTEGER,
    "feasibilityScore" INTEGER,
    "budgetJustificationScore" INTEGER,
    "comments" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictOfInterest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "activeConflictKey" TEXT,
    "reason" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConflictOfInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverdueAlert" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "dueAtSnapshot" TIMESTAMP(3) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverdueAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDecision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "decision" "FundingDecisionStatus" NOT NULL,
    "amountAwarded" DECIMAL(12,2),
    "notes" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRound_name_key" ON "FundingRound"("name");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_fundingRoundId_idx" ON "Application"("fundingRoundId");

-- CreateIndex
CREATE INDEX "Application_ownerId_idx" ON "Application"("ownerId");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE INDEX "Application_archivedAt_idx" ON "Application"("archivedAt");

-- CreateIndex
CREATE INDEX "Application_organizationName_idx" ON "Application"("organizationName");

-- CreateIndex
CREATE INDEX "Application_contactEmail_idx" ON "Application"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerAssignment_activeAssignmentKey_key" ON "ReviewerAssignment"("activeAssignmentKey");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_applicationId_idx" ON "ReviewerAssignment"("applicationId");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_reviewerId_idx" ON "ReviewerAssignment"("reviewerId");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_dueAt_idx" ON "ReviewerAssignment"("dueAt");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_completedAt_idx" ON "ReviewerAssignment"("completedAt");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_removedAt_idx" ON "ReviewerAssignment"("removedAt");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_reviewerId_removedAt_idx" ON "ReviewerAssignment"("reviewerId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_assignmentId_key" ON "Review"("assignmentId");

-- CreateIndex
CREATE INDEX "Review_applicationId_idx" ON "Review"("applicationId");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_applicationId_reviewerId_key" ON "Review"("applicationId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictOfInterest_activeConflictKey_key" ON "ConflictOfInterest"("activeConflictKey");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_applicationId_idx" ON "ConflictOfInterest"("applicationId");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_reviewerId_idx" ON "ConflictOfInterest"("reviewerId");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_resolvedAt_idx" ON "ConflictOfInterest"("resolvedAt");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_applicationId_reviewerId_resolvedAt_idx" ON "ConflictOfInterest"("applicationId", "reviewerId", "resolvedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_applicationId_idx" ON "AuditEvent"("applicationId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_applicationId_createdAt_idx" ON "AuditEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "OverdueAlert_assignmentId_idx" ON "OverdueAlert"("assignmentId");

-- CreateIndex
CREATE INDEX "OverdueAlert_triggeredAt_idx" ON "OverdueAlert"("triggeredAt");

-- CreateIndex
CREATE INDEX "OverdueAlert_dismissedAt_idx" ON "OverdueAlert"("dismissedAt");

-- CreateIndex
CREATE INDEX "OverdueAlert_assignmentId_dueAtSnapshot_idx" ON "OverdueAlert"("assignmentId", "dueAtSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDecision_applicationId_key" ON "FundingDecision"("applicationId");

-- CreateIndex
CREATE INDEX "FundingDecision_decidedById_idx" ON "FundingDecision"("decidedById");

-- CreateIndex
CREATE INDEX "FundingDecision_decidedAt_idx" ON "FundingDecision"("decidedAt");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_fundingRoundId_fkey" FOREIGN KEY ("fundingRoundId") REFERENCES "FundingRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverdueAlert" ADD CONSTRAINT "OverdueAlert_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDecision" ADD CONSTRAINT "FundingDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDecision" ADD CONSTRAINT "FundingDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
