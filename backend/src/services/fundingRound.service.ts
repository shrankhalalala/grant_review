import { prisma } from "../config/prisma.js";

export async function listFundingRounds() {
  return prisma.fundingRound.findMany({
    select: { id: true, name: true, opensAt: true, closesAt: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
