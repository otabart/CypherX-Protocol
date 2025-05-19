export interface TokenHolder {
  address: string;
  balance: string;
  percentage: string; // Percentage of total supply owned
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
}

export interface TokenMetadata {
  decimals: number;
  totalSupply: string;
}