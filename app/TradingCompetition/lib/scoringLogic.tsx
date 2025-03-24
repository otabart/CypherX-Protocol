// app/TradingCompetition/lib/scoringLogic.ts

/**
 * Calculate a composite score using profit (in USD), ROI (%), and number of trades.
 * Formula: score = (profit * weightProfit) + (roi * weightRoi) - (trades * weightTrades)
 */
export function calculateCompositeScore(
    profit: number,  // Profit in USD
    roi: number,     // ROI in percentage (e.g., 42.1 for 42.1%)
    trades: number   // Number of trades
  ): number {
    const weightProfit = 0.5;
    const weightRoi = 0.3;
    const weightTrades = 0.2;
    
    return (profit * weightProfit) + (roi * weightRoi) - (trades * weightTrades);
  }
  
  