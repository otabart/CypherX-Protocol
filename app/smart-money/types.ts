export interface TokenHolder {
  address: string;
  balance: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string; // Added asset field for money flow visualization
}