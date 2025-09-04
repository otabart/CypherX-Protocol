import { ethers } from 'ethers';
// Real-time data types
export interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
}

export interface WalletUpdate {
  address: string;
  ethBalance: string;
  tokenBalances: TokenBalance[];
  lastUpdated: number;
}

export interface TokenBalance {
  contractAddress: string;
  symbol: string;
  name: string;
  balance: string;
  usdValue: number;
  priceUsd: number;
  logo?: string;
}

export interface TransactionUpdate {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
}

// WebSocket message types
export type WSMessage = 
  | { type: 'price_update'; data: PriceUpdate }
  | { type: 'wallet_update'; data: WalletUpdate }
  | { type: 'transaction_update'; data: TransactionUpdate }
  | { type: 'error'; data: { message: string; code: string } };

// Real-time data service
export class RealtimeDataService {
  private static instance: RealtimeDataService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers = new Map<string, Set<(data: any) => void>>();
  private priceCache = new Map<string, PriceUpdate>();
  private walletCache = new Map<string, WalletUpdate>();
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeWebSocket();
    this.startPricePolling();
  }

  static getInstance(): RealtimeDataService {
    if (!RealtimeDataService.instance) {
      RealtimeDataService.instance = new RealtimeDataService();
    }
    return RealtimeDataService.instance;
  }

  // Initialize WebSocket connection
  private initializeWebSocket() {
    try {
      // In production, use a real WebSocket server
      // For now, we'll simulate with polling
      this.isConnected = true;
      this.startHeartbeat();
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: 'ping', data: { timestamp: Date.now() } });
      }
    }, 30000) as unknown as NodeJS.Timeout; // Send ping every 30 seconds
  }

  // Start price polling for tokens
  private startPricePolling() {
    this.priceUpdateInterval = setInterval(async () => {
      await this.updatePrices();
    }, 10000) as unknown as NodeJS.Timeout; // Update prices every 10 seconds
  }

  // Update prices for tracked tokens
  private async updatePrices() {
    try {
      // Get tracked tokens from subscribers
      const trackedTokens = Array.from(this.subscribers.keys())
        .filter(key => key.startsWith('price:'))
        .map(key => key.replace('price:', ''));

      if (trackedTokens.length === 0) return;

      // Fetch prices from multiple sources
      const pricePromises = trackedTokens.map(async (token) => {
        try {
          const price = await this.fetchTokenPrice(token);
          if (price) {
            const update: PriceUpdate = {
              symbol: token,
              price: price.price,
              change24h: price.change24h || 0,
              volume24h: price.volume24h || 0,
              marketCap: price.marketCap || 0,
              timestamp: Date.now()
            };
            
            this.priceCache.set(token, update);
            this.notifySubscribers(`price:${token}`, update);
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${token}:`, error);
        }
      });

      await Promise.allSettled(pricePromises);
    } catch (error) {
      console.error('Failed to update prices:', error);
    }
  }

  // Fetch token price from multiple sources
  private async fetchTokenPrice(tokenAddress: string): Promise<{
    price: number;
    change24h?: number;
    volume24h?: number;
    marketCap?: number;
  } | null> {
    const sources = [
      this.fetchFromDexScreener(tokenAddress),
      this.fetchFromCoinGecko(tokenAddress),
      this.fetchFromBinance(tokenAddress)
    ];

    for (const source of sources) {
      try {
        const result = await source;
        if (result) return result;
      } catch (error) {
        console.error(`Price source failed for ${tokenAddress}:`, error);
      }
    }

    return null;
  }

  // Fetch from DexScreener
  private async fetchFromDexScreener(tokenAddress: string) {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    if (!response.ok) throw new Error('Price data request failed');
    
    const data = await response.json();
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      return {
        price: parseFloat(pair.priceUsd || '0'),
        change24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        marketCap: pair.marketCap || 0
      };
    }
    return null;
  }

  // Fetch from CoinGecko
  private async fetchFromCoinGecko(tokenAddress: string) {
    // For ETH, use CoinGecko
    if (tokenAddress.toLowerCase() === 'ethereum' || tokenAddress.toLowerCase() === 'eth') {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true');
      if (!response.ok) throw new Error('Price data request failed');
      
      const data = await response.json();
      return {
        price: data.ethereum?.usd || 0,
        change24h: data.ethereum?.usd_24h_change || 0,
        volume24h: data.ethereum?.usd_24h_vol || 0,
        marketCap: data.ethereum?.usd_market_cap || 0
      };
    }
    return null;
  }

  // Fetch from Binance
  private async fetchFromBinance(_tokenAddress: string) {
    // This would need token symbol mapping
    // For now, return null
    return null;
  }

  // Subscribe to real-time updates
  subscribe<T>(channel: string, callback: (data: T) => void): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel)!.add(callback as any);
    
    // Return unsubscribe function
    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback as any);
        if (channelSubscribers.size === 0) {
          this.subscribers.delete(channel);
        }
      }
    };
  }

  // Notify subscribers of updates
  private notifySubscribers(channel: string, data: any) {
    const channelSubscribers = this.subscribers.get(channel);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  // Send message through WebSocket
  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Schedule reconnection
  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        this.initializeWebSocket();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Get cached price data
  getCachedPrice(symbol: string): PriceUpdate | null {
    return this.priceCache.get(symbol) || null;
  }

  // Get cached wallet data
  getCachedWallet(address: string): WalletUpdate | null {
    return this.walletCache.get(address) || null;
  }

  // Update wallet data
  async updateWalletData(address: string): Promise<void> {
    try {
      // Fetch wallet data from blockchain
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      
      const ethBalance = await provider.getBalance(address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);
      
      // Fetch token balances (simplified)
      const tokenBalances: TokenBalance[] = [];
      
      const walletUpdate: WalletUpdate = {
        address,
        ethBalance: ethBalanceFormatted,
        tokenBalances,
        lastUpdated: Date.now()
      };
      
      this.walletCache.set(address, walletUpdate);
      this.notifySubscribers(`wallet:${address}`, walletUpdate);
    } catch (error) {
      console.error('Failed to update wallet data:', error);
    }
  }

  // Track transaction
  async trackTransaction(hash: string): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      
      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(hash);
      
      if (receipt) {
        const transactionUpdate: TransactionUpdate = {
          hash,
          from: receipt.from,
          to: receipt.to || '',
          value: '0', // Transaction receipt doesn't have value, would need to get from transaction
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          timestamp: Date.now(),
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.gasPrice?.toString()
        };
        
        this.notifySubscribers(`transaction:${hash}`, transactionUpdate);
      }
    } catch (error) {
      console.error('Failed to track transaction:', error);
    }
  }

  // Subscribe to price updates
  subscribeToPrice(symbol: string, callback: (price: PriceUpdate) => void): () => void {
    return this.subscribe(`price:${symbol}`, callback);
  }

  // Subscribe to wallet updates
  subscribeToWallet(address: string, callback: (wallet: WalletUpdate) => void): () => void {
    return this.subscribe(`wallet:${address}`, callback);
  }

  // Subscribe to transaction updates
  subscribeToTransaction(hash: string, callback: (tx: TransactionUpdate) => void): () => void {
    return this.subscribe(`transaction:${hash}`, callback);
  }

  // Cleanup resources
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.subscribers.clear();
    this.priceCache.clear();
    this.walletCache.clear();
  }
}

// Export singleton instance
export const realtimeDataService = RealtimeDataService.getInstance();
