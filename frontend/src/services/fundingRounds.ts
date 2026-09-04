import { apiRequest } from "./api"; import type { FundingRound } from "../types/fundingRound";
export async function listFundingRounds(token: string) { return (await apiRequest<{ fundingRounds: FundingRound[] }>("/funding-rounds", { token })).fundingRounds; }
