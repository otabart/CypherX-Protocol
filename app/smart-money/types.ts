export interface TokenHolder {
  address: string;
  balance: string;
  percentage: string;
  netFlow?: number; // Added for money flow tracking
  kolName?: string; // Added for KOL identification
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  timestamp?: number; // Added for timeline sorting
  isBuy?: boolean; // Added to determine buy/sell for flow analysis
}

export interface TokenMetadata {
  decimals: number;
  totalSupply: string;
}

export interface TokenTransferTrend {
  token: string;
  totalValue: number;
  transactionCount: number;
}