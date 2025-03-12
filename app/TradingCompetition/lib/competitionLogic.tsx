// competitionLogic.ts
// example logic or utility
export function calculateROI(startBalance: number, endBalance: number): number {
  if (startBalance <= 0) return 0;
  return ((endBalance - startBalance) / startBalance) * 100;
}


  