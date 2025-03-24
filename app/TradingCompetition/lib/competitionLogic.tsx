// app/TradingCompetition/lib/competitionLogic.ts
export function calculateROI(startBalance: number, endBalance: number): number {
  if (startBalance <= 0) return 0;
  return ((endBalance - startBalance) / startBalance) * 100;
}

export function calculateDynamicPrizePool(
  basePrizePool: number,
  contributionPerParticipant: number,
  participantCount: number
): number {
  return basePrizePool + contributionPerParticipant * participantCount;
}





  