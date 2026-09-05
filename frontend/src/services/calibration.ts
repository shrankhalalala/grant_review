import { apiRequest } from "./api";
import type { CalibrationReport } from "../types/calibration";

export async function getCalibration(token: string, fundingRoundId?: string) {
  const query = fundingRoundId ? `?fundingRoundId=${encodeURIComponent(fundingRoundId)}` : "";
  return (await apiRequest<{ calibration: CalibrationReport }>(`/reviewers/calibration${query}`, { token })).calibration;
}
