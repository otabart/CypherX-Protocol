import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface PnLData {
  date: string;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  trades: number;
  volume: number;
}

interface Trade {
  id: string;
  type: "buy" | "sell";
  token: string;
  amount: number;
  price: number;
  value: number;
  timestamp: number;
  gasCost: number;
}

interface FirestoreTradeData {
  timestamp: { toDate: () => Date };
  inputToken: string;
  inputValue: number;
  [key: string]: unknown;
}

interface FirestoreTrade {
  data?: () => FirestoreTradeData;
  [key: string]: unknown;
}

interface PnLResponse {
  pnlData: PnLData[];
  trades: Trade[];
  totalPnL: number;
  totalPnLPercentage: number;
  totalVolume: number;
  totalTrades: number;
}

// Get ETH price for USD conversion
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return 0;
  }
}

// Get token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    return await getEthPrice();
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0;
  }
}

// Calculate PnL for a trade
function calculateTradePnL(trade: { type: string; price: number; amount: number; gasCost: number }, currentPrice: number): number {
  if (trade.type === "buy") {
    return (currentPrice - trade.price) * trade.amount - trade.gasCost;
  } else {
    return (trade.price - currentPrice) * trade.amount - trade.gasCost;
  }
}

// Group trades by date
function groupTradesByDate(trades: FirestoreTrade[]): Record<string, FirestoreTradeData[]> {
  const grouped: Record<string, FirestoreTradeData[]> = {};
  
  trades.forEach(trade => {
    const data = trade.data ? trade.data() : trade as FirestoreTradeData;
    const date = new Date(data.timestamp.toDate()).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(data);
  });
  
  return grouped;
}

// Calculate daily PnL data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function calculateDailyPnL(trades: any[]): Promise<PnLData[]> {
  const groupedTrades = groupTradesByDate(trades);
  const dates = Object.keys(groupedTrades).sort();
  
  const pnlData: PnLData[] = [];
  let runningValue = 0;
  let runningPnL = 0;
  
  for (const date of dates) {
    const dayTrades = groupedTrades[date];
    let dayVolume = 0;
    let dayPnL = 0;
    
    for (const trade of dayTrades) {
      // Calculate current price for PnL
      const currentPrice = await getTokenPrice(trade.inputToken === "ETH" ? "0x0000000000000000000000000000000000000000" : trade.inputToken);
      
      dayVolume += trade.inputValue || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dayPnL += calculateTradePnL(trade as any, currentPrice);
    }
    
    runningValue += dayVolume;
    runningPnL += dayPnL;
    
    pnlData.push({
      date,
      totalValue: runningValue,
      pnl: runningPnL,
      pnlPercentage: runningValue > 0 ? (runningPnL / runningValue) * 100 : 0,
      trades: dayTrades.length,
      volume: dayVolume
    });
  }
  
  return pnlData;
}



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    
    if (!address) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }
    
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    
    // Fetch wallet transactions
    const transactionsQuery = db.collection("wallet_transactions")
      .where("walletAddress", "==", address)
      .where("type", "==", "swap")
      .orderBy("timestamp", "desc");
    
    const transactionsSnapshot = await transactionsQuery.get();
    
    if (transactionsSnapshot.empty) {
      return NextResponse.json({
        pnlData: [],
        trades: [],
        totalPnL: 0,
        totalPnLPercentage: 0,
        totalVolume: 0,
        totalTrades: 0
      });
    }
    
    // Convert to trades format
    const trades: Trade[] = transactionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.inputToken === "ETH" ? "buy" : "sell",
        token: data.outputToken,
        amount: parseFloat(data.outputAmount),
        price: data.outputValue / parseFloat(data.outputAmount),
        value: data.outputValue,
        timestamp: data.timestamp.toDate().getTime(),
        gasCost: data.gasCostUsd || 0
      };
    });
    

    
    // Calculate PnL data
    const pnlData = await calculateDailyPnL(transactionsSnapshot.docs);
    
    // Calculate totals
    const totalVolume = trades.reduce((sum, trade) => sum + trade.value, 0);
    const totalTrades = trades.length;
    
    // Calculate total PnL
    let totalPnL = 0;
    for (const trade of trades) {
      const currentPrice = await getTokenPrice(trade.token === "ETH" ? "0x0000000000000000000000000000000000000000" : trade.token);
      totalPnL += calculateTradePnL(trade, currentPrice);
    }
    
    const totalPnLPercentage = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;
    
    const response: PnLResponse = {
      pnlData,
      trades: trades.slice(0, 50), // Limit to recent 50 trades
      totalPnL,
      totalPnLPercentage,
      totalVolume,
      totalTrades
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Error calculating PnL:", error);
    return NextResponse.json(
      { error: "Failed to calculate PnL" },
      { status: 500 }
    );
  }
}
