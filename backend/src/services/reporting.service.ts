import { ReviewStatus } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

function cell(value: string | number | Date | null) {
  const text = value === null ? "" : value instanceof Date ? value.toISOString() : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportCompletedReviewsCsv(fundingRoundId: string) {
  const fundingRound = await prisma.fundingRound.findUnique({ where: { id: fundingRoundId } });
  if (!fundingRound) throw new HttpError(404, "Funding round not found.");
  const reviews = await prisma.review.findMany({
    where: { status: ReviewStatus.COMPLETED, application: { is: { fundingRoundId } } },
    include: {
      application: { select: { id: true, organizationName: true, contactEmail: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ applicationId: "asc" }, { completedAt: "asc" }],
  });
  const header = ["Application ID", "Organization", "Contact Email", "Reviewer ID", "Reviewer", "Reviewer Email", "Review ID", "Completed At", "Impact", "Feasibility", "Budget Justification"];
  const rows = reviews.map((review) => [review.application.id, review.application.organizationName, review.application.contactEmail, review.reviewer.id, review.reviewer.name, review.reviewer.email, review.id, review.completedAt, review.impactScore, review.feasibilityScore, review.budgetJustificationScore].map(cell).join(","));
  return [header.map(cell).join(","), ...rows].join("\r\n");
}
