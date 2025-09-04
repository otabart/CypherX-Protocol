import React from 'react';
import { realtimeDataService } from '@/lib/realtime-data';
import type { PriceUpdate, WalletUpdate, TransactionUpdate } from '@/lib/realtime-data';

// React hook for real-time data
export function useRealtimeData<T>(channel: string, initialData?: T): [T | null, (data: T) => void] {
  const [data, setData] = React.useState<T | null>(initialData || null);
  
  React.useEffect(() => {
    const unsubscribe = realtimeDataService.subscribe<T>(channel, setData);
    return unsubscribe;
  }, [channel]);
  
  return [data, setData];
}

// Hook for price updates
export function usePriceUpdates(symbol: string): [PriceUpdate | null, (price: PriceUpdate) => void] {
  const [price] = useRealtimeData<PriceUpdate>(`price:${symbol}`, realtimeDataService.getCachedPrice(symbol) || undefined);
  return [price, () => {}]; // No update function available
}

// Hook for wallet updates
export function useWalletUpdates(address: string): [WalletUpdate | null, (wallet: WalletUpdate) => void] {
  const [wallet] = useRealtimeData<WalletUpdate>(`wallet:${address}`, realtimeDataService.getCachedWallet(address) || undefined);
  return [wallet, () => {}]; // No update function available
}

// Hook for transaction updates
export function useTransactionUpdates(hash: string): [TransactionUpdate | null, (tx: TransactionUpdate) => void] {
  const [transaction] = useRealtimeData<TransactionUpdate>(`transaction:${hash}`);
  return [transaction, () => {}]; // No update function available
}
