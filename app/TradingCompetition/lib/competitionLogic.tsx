// app/TradingCompetition/lib/competitionLogic.tsx

/**
 * Calculates the Return on Investment (ROI) as a percentage.
 * @param startBalance The initial balance before trading.
 * @param endBalance The final balance after trading.
 * @returns The ROI percentage, or 0 if startBalance is invalid (<= 0).
 */
export function calculateROI(startBalance: number, endBalance: number): number {
  if (startBalance <= 0) return 0;
  return ((endBalance - startBalance) / startBalance) * 100;
}

/**
 * Calculates the total prize pool dynamically based on a base amount and participant contributions.
 * @param basePrizePool The fixed base prize pool amount.
 * @param contributionPerParticipant The contribution added per participant.
 * @param participantCount The number of participants in the competition.
 * @returns The total prize pool amount.
 */
export function calculateDynamicPrizePool(
  basePrizePool: number,
  contributionPerParticipant: number,
  participantCount: number
): number {
  return basePrizePool + contributionPerParticipant * participantCount;
}






  