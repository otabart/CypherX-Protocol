import { ethers } from "ethers";
import { adminDb } from "./lib/firebase-admin";
import { getCoins, setApiKey } from "@zoralabs/coins-sdk";
import axios from "axios";
import * as schedule from "node-schedule";

// Add type declarations to avoid TypeScript errors
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ZORA_API_KEY?: string;
      CLANKER_API_KEY?: string;
      BASE_RPC_URL?: string;
      LOG_LEVEL?: string;
    }
  }
}

// Configuration
const CONFIG = {
  // RPC URLs
  BASE_RPC: "https://base.llamarpc.com",
  
  // DEX Factories to monitor
  FACTORIES: [
    {
      name: "Aerodrome",
      address: "0x420dd381b31aef6683fa7e9d3c33269d4e2b66bf",
      type: "aerodrome"
    },
    {
      name: "BaseSwap",
      address: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", 
      type: "baseswap"
    },
    {
      name: "UniswapV3",
      address: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
      type: "uniswap_v3"
    },
    {
      name: "PancakeSwap",
      address: "0x02a84c1b3bbd7401a5f7fa98a384ebc70bb5749e",
      type: "pancakeswap"
    }
  ],
  
  // API Keys
  ZORA_API_KEY: process.env.ZORA_API_KEY || "zora_api_a9628962c935e17de3c0c5176553e1c643c89b51b23ead436684f45e4e8c45ed",
  CLANKER_API_KEY: process.env.CLANKER_API_KEY || "",
  
  // Update intervals
  FACTORY_POLL_INTERVAL: 30000, // 30 seconds
  MARKET_DATA_UPDATE_INTERVAL: 60000, // 1 minute
  SCORING_UPDATE_INTERVAL: 300000, // 5 minutes
  
  // DexScreener API limits
  DEXSCREENER_BATCH_SIZE: 10,
  DEXSCREENER_RATE_LIMIT: 1000, // ms between requests
  
  // Token scoring weights
  SCORING_WEIGHTS: {
    volume24h: 0.25,
    priceChange24h: 0.20,
    volumeToMarketCapRatio: 0.15,
    liquidity: 0.15,
    holders: 0.10,
    age: 0.10,
    buyPercentage: 0.05
  }
};

// Types
interface TokenData {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  marketCap: number;
  volume24h: number;
  uniqueHolders: number;
  totalSupply: number;
  creatorAddress: string;
  createdAt: string | Date;
  mediaContent?: string;
  source: string;
  dexName: string;
  dexId?: string;
  pairAddress?: string;
  description: string;
  website: string;
  telegram: string;
  twitter: string;
  discord?: string;
  totalVolume?: number;
  marketCapDelta24h?: number;
  tokenUri?: string;
  lastUpdated?: Date | string;
  tags?: string[];
  priceUsd?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
  };
  info?: {
    imageUrl?: string;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  score?: number;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h1: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  info?: {
    imageUrl?: string;
  };
}

// Initialize providers and services
const provider = new ethers.JsonRpcProvider(CONFIG.BASE_RPC);
const adminDatabase = adminDb();

// Set up Zora API
setApiKey(CONFIG.ZORA_API_KEY);

// Factory monitoring
class FactoryMonitor {
  private lastBlocks: Map<string, number> = new Map();
  private isMonitoring = false;

  async startMonitoring() {
    console.log("🏭 Starting factory monitoring...");
    
    for (const factory of CONFIG.FACTORIES) {
      this.lastBlocks.set(factory.name, await provider.getBlockNumber() - 1000);
      this.monitorFactory(factory);
    }
  }

  private async monitorFactory(factory: typeof CONFIG.FACTORIES[0]) {
    const factoryABI = [
      "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
    ];
    
    const contract = new ethers.Contract(factory.address, factoryABI, provider);
    const pairCreatedTopic = ethers.id("PairCreated(address,address,address,uint256)");

    setInterval(async () => {
      if (this.isMonitoring) return;
      this.isMonitoring = true;

      try {
        const currentBlock = await provider.getBlockNumber();
        const lastBlock = this.lastBlocks.get(factory.name) || currentBlock - 1000;

        if (currentBlock > lastBlock) {
          const logs = await provider.getLogs({
            address: factory.address,
            fromBlock: lastBlock + 1,
            toBlock: currentBlock,
            topics: [pairCreatedTopic]
          });

          for (const log of logs) {
            const parsed = contract.interface.parseLog(log);
            if (!parsed) continue;
            const token0 = parsed.args.token0;
            const token1 = parsed.args.token1;
            const pairAddress = parsed.args.pair;

            // Determine which token is the actual token (not WETH/USDC)
            const wethAddress = "0x4200000000000000000000000000000000000006";
            const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            
            let tokenAddress = token0;
            if (token0.toLowerCase() === wethAddress.toLowerCase() || 
                token0.toLowerCase() === usdcAddress.toLowerCase()) {
              tokenAddress = token1;
            }

            await this.addNewToken(tokenAddress, factory.name, pairAddress);
          }

          this.lastBlocks.set(factory.name, currentBlock);
        }
      } catch (error) {
        console.error(`❌ Error monitoring ${factory.name}:`, error);
      } finally {
        this.isMonitoring = false;
      }
    }, CONFIG.FACTORY_POLL_INTERVAL);
  }

  private async addNewToken(tokenAddress: string, dexName: string, pairAddress: string) {
    try {
      const now = new Date();
      const tokenData: Partial<TokenData> = {
        address: tokenAddress,
        name: "Unknown",
        symbol: "UNKNOWN",
        marketCap: 0,
        volume24h: 0,
        uniqueHolders: 0,
        totalSupply: 0,
        creatorAddress: "",
        createdAt: now,
        source: "factory_monitor",
        dexName: dexName,
        pairAddress: pairAddress,
        description: "",
        website: "",
        telegram: "",
        twitter: "",
        lastUpdated: now
      };

      // Save to Firebase
      if (adminDatabase) {
        await adminDatabase.collection("Cypherscope").doc(tokenAddress).set(tokenData, { merge: true });
        console.log(`✅ Added new token: ${tokenAddress} from ${dexName}`);
      }
    } catch (error) {
      console.error(`❌ Error adding token ${tokenAddress}:`, error);
    }
  }
}

// Market data fetcher
class MarketDataFetcher {
  async fetchDexScreenerData(tokenAddresses: string[]): Promise<Map<string, DexScreenerPair>> {
    const results = new Map<string, DexScreenerPair>();
    
    // Batch requests to avoid rate limits
    for (let i = 0; i < tokenAddresses.length; i += CONFIG.DEXSCREENER_BATCH_SIZE) {
      const batch = tokenAddresses.slice(i, i + CONFIG.DEXSCREENER_BATCH_SIZE);
      const joinedBatch = batch.join(",");
      
      try {
        const response = await axios.get(
          `https://api.dexscreener.com/latest/dex/tokens/${joinedBatch}`,
          {
            headers: { Accept: "application/json" },
            timeout: 10000
          }
        );

        if (response.data && response.data.pairs) {
          for (const pair of response.data.pairs) {
            if (pair.baseToken && pair.baseToken.address) {
              results.set(pair.baseToken.address.toLowerCase(), pair);
            }
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, CONFIG.DEXSCREENER_RATE_LIMIT));
      } catch (error) {
        console.error(`❌ DexScreener API error for batch ${i}:`, error);
      }
    }

    return results;
  }

  async fetchClankerData(tokenAddresses: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    if (!CONFIG.CLANKER_API_KEY) {
      console.log("⚠️ Clanker API key not configured");
      return results;
    }

    try {
      // Clanker API endpoint (you'll need to adjust based on their actual API)
      const response = await axios.get(
        `https://api.clanker.com/tokens/batch`,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.CLANKER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: { addresses: tokenAddresses },
          timeout: 10000
        }
      );

      if (response.data && response.data.tokens) {
        for (const token of response.data.tokens) {
          results.set(token.address.toLowerCase(), token);
        }
      }
    } catch (error) {
      console.error("❌ Clanker API error:", error);
    }

    return results;
  }

  async fetchZoraData(tokenAddresses: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    try {
      const response = await getCoins({
        coins: tokenAddresses.map(address => ({
          collectionAddress: address,
          chainId: 8453
        }))
      });

      const zoraTokens = response?.data?.zora20Tokens || [];
      
      for (const token of zoraTokens) {
        if (token && token.address) {
          results.set(token.address.toLowerCase(), token);
        }
      }
    } catch (error) {
      console.error("❌ Zora API error:", error);
    }

    return results;
  }
}

// Token scorer
class TokenScorer {
  calculateScore(token: TokenData): number {
    let score = 0;
    const weights = CONFIG.SCORING_WEIGHTS;

    // Volume 24h (0-25 points)
    const volume24h = parseFloat(String(token.volume24h || 0));
    if (volume24h > 1000000) score += weights.volume24h * 100; // $1M+
    else if (volume24h > 500000) score += weights.volume24h * 80; // $500K+
    else if (volume24h > 100000) score += weights.volume24h * 60; // $100K+
    else if (volume24h > 50000) score += weights.volume24h * 40; // $50K+
    else if (volume24h > 10000) score += weights.volume24h * 20; // $10K+

    // Price change 24h (0-20 points)
    const priceChange24h = token.priceChange?.h24 || 0;
    if (priceChange24h > 50) score += weights.priceChange24h * 100;
    else if (priceChange24h > 20) score += weights.priceChange24h * 80;
    else if (priceChange24h > 10) score += weights.priceChange24h * 60;
    else if (priceChange24h > 5) score += weights.priceChange24h * 40;
    else if (priceChange24h > 0) score += weights.priceChange24h * 20;

    // Volume to market cap ratio (0-15 points)
    const marketCap = parseFloat(String(token.marketCap || 0));
    if (marketCap > 0) {
      const volumeToMcRatio = volume24h / marketCap;
      if (volumeToMcRatio > 1) score += weights.volumeToMarketCapRatio * 100;
      else if (volumeToMcRatio > 0.5) score += weights.volumeToMarketCapRatio * 80;
      else if (volumeToMcRatio > 0.2) score += weights.volumeToMarketCapRatio * 60;
      else if (volumeToMcRatio > 0.1) score += weights.volumeToMarketCapRatio * 40;
    }

    // Liquidity (0-15 points)
    const liquidity = parseFloat(String(token.liquidity?.usd || 0));
    if (liquidity > 100000) score += weights.liquidity * 100;
    else if (liquidity > 50000) score += weights.liquidity * 80;
    else if (liquidity > 25000) score += weights.liquidity * 60;
    else if (liquidity > 10000) score += weights.liquidity * 40;
    else if (liquidity > 5000) score += weights.liquidity * 20;

    // Holders (0-10 points)
    const holders = parseInt(String(token.uniqueHolders || 0));
    if (holders > 1000) score += weights.holders * 100;
    else if (holders > 500) score += weights.holders * 80;
    else if (holders > 200) score += weights.holders * 60;
    else if (holders > 100) score += weights.holders * 40;
    else if (holders > 50) score += weights.holders * 20;

    // Age bonus (0-10 points) - newer tokens get higher scores
    if (token.createdAt) {
      const created = new Date(token.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff <= 1) score += weights.age * 100; // < 1 hour
      else if (hoursDiff <= 6) score += weights.age * 80; // < 6 hours
      else if (hoursDiff <= 24) score += weights.age * 60; // < 24 hours
      else if (hoursDiff <= 72) score += weights.age * 40; // < 3 days
      else if (hoursDiff <= 168) score += weights.age * 20; // < 1 week
    }

    // Buy percentage (0-5 points)
    if (token.txns?.h24) {
      const { buys, sells } = token.txns.h24;
      const total = buys + sells;
      if (total > 0) {
        const buyPercentage = (buys / total) * 100;
        if (buyPercentage > 70) score += weights.buyPercentage * 100;
        else if (buyPercentage > 60) score += weights.buyPercentage * 80;
        else if (buyPercentage > 50) score += weights.buyPercentage * 60;
      }
    }

    return Math.round(score);
  }

  generateTags(token: TokenData): string[] {
    const tags: string[] = [];
    
    // Source tag
    tags.push(token.source.toUpperCase());
    
    // NEW tag - if created in last 24 hours
    if (token.createdAt) {
      const created = new Date(token.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (hoursDiff <= 24) {
        tags.push('NEW');
      }
    }
    
    // SURGING tag - based on volume and positive price movement
    const volume24h = parseFloat(String(token.volume24h || 0));
    const priceChange24h = token.priceChange?.h24 || 0;
    const marketCap = parseFloat(String(token.marketCap || 0));
    
    if (priceChange24h > 0) {
      let surgeScore = 0;
      
      // Volume scoring
      if (volume24h > 1000000) surgeScore += 4;
      else if (volume24h > 500000) surgeScore += 3;
      else if (volume24h > 100000) surgeScore += 2;
      else if (volume24h > 50000) surgeScore += 1;
      
      // Price movement scoring
      if (priceChange24h > 50) surgeScore += 3;
      else if (priceChange24h > 20) surgeScore += 2;
      else if (priceChange24h > 10) surgeScore += 1;
      
      // Volume to market cap ratio
      if (marketCap > 0) {
        const volumeToMcRatio = volume24h / marketCap;
        if (volumeToMcRatio > 0.5) surgeScore += 2;
        else if (volumeToMcRatio > 0.2) surgeScore += 1;
      }
      
      if (surgeScore >= 4) {
        tags.push('SURGING');
      }
    }
    
    // VOLUME tag - if volume > $50K
    if (volume24h > 50000) {
      tags.push('VOLUME');
    }
    
    // RUNNER tag - if market cap < $500K and volume > $10K
    if (marketCap < 500000 && volume24h > 10000) {
      tags.push('RUNNER');
    }
    
    // TRENDING tag - if holders > 500
    const holders = parseInt(String(token.uniqueHolders || 0));
    if (holders > 500) {
      tags.push('TRENDING');
    }
    
    // LIQUIDITY tag - if liquidity > $50K
    const liquidity = parseFloat(String(token.liquidity?.usd || 0));
    if (liquidity > 50000) {
      tags.push('LIQUIDITY');
    }
    
    // MOONSHOT tag - if market cap < $100K but volume > $5K
    if (marketCap < 100000 && volume24h > 5000) {
      tags.push('MOONSHOT');
    }
    
    // ESTABLISHED tag - if market cap > $5M
    if (marketCap > 5000000) {
      tags.push('ESTABLISHED');
    }
    
    // GAINER tag - if price change > 20%
    if (priceChange24h > 20) {
      tags.push('GAINER');
    }
    
    return tags;
  }
}

// Main aggregator class
class TokenAggregator {
  private factoryMonitor: FactoryMonitor;
  private marketDataFetcher: MarketDataFetcher;
  private tokenScorer: TokenScorer;

  constructor() {
    this.factoryMonitor = new FactoryMonitor();
    this.marketDataFetcher = new MarketDataFetcher();
    this.tokenScorer = new TokenScorer();
  }

  async start() {
    console.log("🚀 Starting Token Aggregator...");
    
    // Start factory monitoring
    await this.factoryMonitor.startMonitoring();
    
    // Schedule market data updates
    schedule.scheduleJob('*/1 * * * *', () => this.updateMarketData()); // Every minute
    
    // Schedule scoring updates
    schedule.scheduleJob('*/5 * * * *', () => this.updateTokenScores()); // Every 5 minutes
    
    console.log("✅ Token Aggregator started successfully!");
  }

  private async updateMarketData() {
    try {
      console.log("📊 Updating market data...");
      
      // Get all tokens from Firebase
      if (!adminDatabase) {
        console.error("❌ Firebase admin not initialized");
        return;
      }

      const snapshot = await adminDatabase.collection("Cypherscope")
        .orderBy("lastUpdated", "asc")
        .limit(100)
        .get();

      const tokens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TokenData[];

      if (tokens.length === 0) {
        console.log("⚠️ No tokens found to update");
        return;
      }

      const tokenAddresses = tokens.map(t => t.address);
      
      // Fetch market data from multiple sources
      const [dexScreenerData, clankerData, zoraData] = await Promise.all([
        this.marketDataFetcher.fetchDexScreenerData(tokenAddresses),
        this.marketDataFetcher.fetchClankerData(tokenAddresses),
        this.marketDataFetcher.fetchZoraData(tokenAddresses)
      ]);

      // Update tokens with market data
      const batch = adminDatabase.batch();
      let updatedCount = 0;

      for (const token of tokens) {
        const tokenAddress = token.address.toLowerCase();
        let updated = false;
        const updates: any = {};

        // Update with DexScreener data
        const dexScreenerPair = dexScreenerData.get(tokenAddress);
        if (dexScreenerPair) {
          updates.priceUsd = dexScreenerPair.priceUsd;
          updates.priceChange = dexScreenerPair.priceChange;
          updates.volume = dexScreenerPair.volume;
          updates.liquidity = dexScreenerPair.liquidity;
          updates.marketCap = dexScreenerPair.marketCap;
          updates.txns = dexScreenerPair.txns;
          updates.info = dexScreenerPair.info;
          updates.volume24h = dexScreenerPair.volume.h24;
          updates.dexId = dexScreenerPair.dexId;
          updated = true;
        }

        // Update with Clanker data
        const clankerToken = clankerData.get(tokenAddress);
        if (clankerToken) {
          // Merge Clanker specific data
          Object.assign(updates, clankerToken);
          updated = true;
        }

        // Update with Zora data
        const zoraToken = zoraData.get(tokenAddress);
        if (zoraToken) {
          updates.name = zoraToken.name || token.name;
          updates.symbol = zoraToken.symbol || token.symbol;
          updates.description = zoraToken.description || token.description;
          updates.website = zoraToken.website || token.website;
          updates.telegram = zoraToken.telegram || token.telegram;
          updates.twitter = zoraToken.twitter || token.twitter;
          updated = true;
        }

        if (updated && token.id) {
          updates.lastUpdated = new Date();
          const docRef = adminDatabase.collection("Cypherscope").doc(token.id);
          batch.update(docRef, updates);
          updatedCount++;
        }
      }

      await batch.commit();
      console.log(`✅ Updated ${updatedCount} tokens with market data`);
      
    } catch (error) {
      console.error("❌ Error updating market data:", error);
    }
  }

  private async updateTokenScores() {
    try {
      console.log("🎯 Updating token scores...");
      
      if (!adminDatabase) {
        console.error("❌ Firebase admin not initialized");
        return;
      }

      const snapshot = await adminDatabase.collection("Cypherscope")
        .orderBy("lastUpdated", "desc")
        .limit(200)
        .get();

      const tokens = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TokenData[];

      const batch = adminDatabase.batch();
      let scoredCount = 0;

      for (const token of tokens) {
        const score = this.tokenScorer.calculateScore(token);
        const tags = this.tokenScorer.generateTags(token);

        if (token.id) {
          const docRef = adminDatabase.collection("Cypherscope").doc(token.id);
          batch.update(docRef, {
            score: score,
            tags: tags,
            lastScored: new Date()
          });
          scoredCount++;
        }
      }

      await batch.commit();
      console.log(`✅ Scored ${scoredCount} tokens`);
      
    } catch (error) {
      console.error("❌ Error updating token scores:", error);
    }
  }
}

// Start the aggregator
async function main() {
  try {
    const aggregator = new TokenAggregator();
    await aggregator.start();
    
    console.log("🎉 Token Aggregator is running!");
    console.log("📊 Monitoring factories for new tokens...");
    console.log("🔄 Updating market data every minute...");
    console.log("🎯 Scoring tokens every 5 minutes...");
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log("\n🛑 Shutting down Token Aggregator...");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("❌ Failed to start Token Aggregator:", error);
    process.exit(1);
  }
}

// Run the aggregator
main();
