import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";

// Search result types
interface TokenSearchResult {
  type: "token";
  address: string;
  poolAddress?: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  priceUsd?: string;
  liquidity?: { usd: number };
  source: string;
  imageUrl?: string;
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
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  // Additional metadata from DexScreener
  fdv?: number;
  pairCreatedAt?: number;
  dexId?: string;
  url?: string;
  metrics?: {
    priceChange24h: number;
    priceChange1h: number;
    priceChange6h: number;
    priceChange5m: number;
    totalTxns24h: number;
    totalTxns1h: number;
    totalTxns6h: number;
    buyRatio24h: number;
    buyRatio1h: number;
    volumeChange24h: number;
    liquidityChange24h: number;
  };
}

interface WalletSearchResult {
  type: "wallet";
  address: string;
  balance?: string;
  transactionCount?: number;
  lastActivity?: string | null;
}

interface TransactionSearchResult {
  type: "transaction";
  hash: string;
  blockNumber?: number | null;
  from: string;
  to: string;
  value?: string;
  status?: number | null;
  timestamp?: number;
}

interface BlockSearchResult {
  type: "block";
  number: number;
  hash: string | null;
  timestamp?: number;
  transactions?: number;
  gasUsed?: string | null;
  gasLimit?: string | null;
}

interface NewsSearchResult {
  type: "news";
  id: string;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  thumbnailUrl?: string;
}

interface IndexSearchResult {
  type: "index";
  indexName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  weight: number;
  marketCap?: number;
  priceUsd?: string;
}

interface CalendarEventSearchResult {
  type: "calendar";
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
  status: string;
  votes: number;
}

interface SearchResult {
  tokens: TokenSearchResult[];
  wallets: WalletSearchResult[];
  transactions: TransactionSearchResult[];
  blocks: BlockSearchResult[];
  news: NewsSearchResult[];
  indexes: IndexSearchResult[];
  calendar: CalendarEventSearchResult[];
}

// Helper function to check if string is an Ethereum address
function isEthereumAddress(str: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(str);
}

// Helper function to check if string is a transaction hash
function isTransactionHash(str: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(str);
}

// Helper function to check if string is a block number
function isBlockNumber(str: string): boolean {
  return /^\d+$/.test(str);
}

// Search tokens from multiple sources
async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  const results: TokenSearchResult[] = [];
  
  try {
    // Only search in our tokens collection
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tokens?search=${encodeURIComponent(query)}&limit=10`);
    if (response.ok) {
      const data = await response.json();
      if (data.tokens) {
        // Enhance our tokens with DexScreener data using the same pattern as token screener
        const enhancedTokens = await Promise.all(
          data.tokens.map(async (token: any) => {
            // Use the same DexScreener API pattern as token screener
            const dexResponse = await fetch(`https://api.dexscreener.com/tokens/v1/base/${token.address}`, {
              headers: { Accept: "application/json" }
            });
            
            if (dexResponse.ok) {
              const dexData = await dexResponse.json();
              const pair = Array.isArray(dexData) ? dexData[0] : dexData;
              
              if (pair && pair.baseToken) {
                const priceChange = pair.priceChange || {};
                const volume = pair.volume || {};
                const txns = pair.txns || {};
                
                const priceUsd = parseFloat(pair.priceUsd || "0");
                const marketCap = parseFloat(pair.marketCap || "0");
                const liquidityUsd = parseFloat(pair.liquidity?.usd || "0");
                const volume24h = parseFloat(volume.h24 || "0");
                const volume1h = parseFloat(volume.h1 || "0");
                
                const priceChange24h = parseFloat(priceChange.h24 || "0");
                const priceChange1h = parseFloat(priceChange.h1 || "0");
                const priceChange6h = parseFloat(priceChange.h6 || "0");
                const priceChange5m = parseFloat(priceChange.m5 || "0");
                
                const totalTxns24h = (txns.h24?.buys || 0) + (txns.h24?.sells || 0);
                const totalTxns1h = (txns.h1?.buys || 0) + (txns.h1?.sells || 0);
                const totalTxns6h = (txns.h6?.buys || 0) + (txns.h6?.sells || 0);
                
                const buyRatio24h = totalTxns24h > 0 ? (txns.h24?.buys || 0) / totalTxns24h : 0;
                const buyRatio1h = totalTxns1h > 0 ? (txns.h1?.buys || 0) / totalTxns1h : 0;
                
                return {
                  type: "token" as const,
                  address: token.address,
                  poolAddress: pair.pairAddress || token.poolAddress,
                  name: token.name,
                  symbol: token.symbol,
                  marketCap: marketCap || token.marketCap,
                  volume24h: volume24h || token.volume24h,
                  priceUsd: priceUsd > 0 ? priceUsd.toString() : undefined,
                  liquidity: { usd: liquidityUsd },
                  source: "CypherX",
                  imageUrl: pair.info?.imageUrl || undefined,
                  priceChange: {
                    m5: priceChange5m,
                    h1: priceChange1h,
                    h6: priceChange6h,
                    h24: priceChange24h
                  },
                  volume: {
                    h1: volume1h,
                    h24: volume24h
                  },
                  txns: {
                    h1: { buys: txns.h1?.buys || 0, sells: txns.h1?.sells || 0 },
                    h6: { buys: txns.h6?.buys || 0, sells: txns.h6?.sells || 0 },
                    h24: { buys: txns.h24?.buys || 0, sells: txns.h24?.sells || 0 }
                  },
                  fdv: parseFloat(pair.fdv || "0"),
                  pairCreatedAt: pair.pairCreatedAt,
                  dexId: pair.dexId,
                  url: pair.url,
                  metrics: {
                    priceChange24h,
                    priceChange1h,
                    priceChange6h,
                    priceChange5m,
                    totalTxns24h,
                    totalTxns1h,
                    totalTxns6h,
                    buyRatio24h,
                    buyRatio1h,
                    volumeChange24h: volume24h > 0 ? ((volume24h - parseFloat(volume.h6 || "0")) / volume24h) * 100 : 0,
                    liquidityChange24h: liquidityUsd > 0 ? ((liquidityUsd - parseFloat(pair.liquidity?.h24 || "0")) / liquidityUsd) * 100 : 0
                  }
                };
              }
            }
            
            // Fallback to basic token data if DexScreener data not available
            return {
              type: "token" as const,
              address: token.address,
              poolAddress: token.poolAddress,
              name: token.name,
              symbol: token.symbol,
              marketCap: token.marketCap,
              volume24h: token.volume24h,
              source: "CypherX",
              imageUrl: undefined
            };
          })
        );
        
        results.push(...enhancedTokens);
      }
    }
  } catch (error) {
    console.error("Error searching CypherX tokens:", error);
  }

  return results.slice(0, 10);
}

// Search news articles
async function searchNews(query: string): Promise<NewsSearchResult[]> {
  const results: NewsSearchResult[] = [];
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/news`);
    if (response.ok) {
      const articles = await response.json();
      
      // Filter articles by title, content, or author
      const filteredArticles = articles.filter((article: any) => {
        const searchText = query.toLowerCase();
        return (
          article.title?.toLowerCase().includes(searchText) ||
          article.content?.toLowerCase().includes(searchText) ||
          article.author?.toLowerCase().includes(searchText) ||
          article.source?.toLowerCase().includes(searchText)
        );
      });
      
      results.push(...filteredArticles.slice(0, 5).map((article: any) => ({
        type: "news" as const,
        id: article.id || article.slug,
        title: article.title,
        content: article.content,
        author: article.author,
        source: article.source,
        publishedAt: article.publishedAt,
        slug: article.slug,
        thumbnailUrl: article.thumbnailUrl
      })));
    }
  } catch (error) {
    console.error("Error searching news:", error);
  }

  return results;
}

// Search index data
async function searchIndexes(query: string): Promise<IndexSearchResult[]> {
  const results: IndexSearchResult[] = [];
  
  try {
    // Search through all available indexes
    const indexes = ['CDEX', 'BDEX', 'VDEX', 'AIDEX'];
    
    for (const indexName of indexes) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tokens?collection=${indexName}&search=${encodeURIComponent(query)}&limit=5`);
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens.length > 0) {
            // Only include tokens that are actually in this index and have a weight
            const validTokens = data.tokens.filter((token: any) => token.weight && token.weight > 0);
            if (validTokens.length > 0) {
              results.push(...validTokens.map((token: any) => ({
                type: "index" as const,
                indexName,
                tokenAddress: token.address,
                tokenSymbol: token.symbol,
                tokenName: token.name,
                weight: token.weight || 0,
                marketCap: token.marketCap,
                priceUsd: token.priceUsd
              })));
            }
          }
        }
      } catch (error) {
        console.error(`Error searching ${indexName} index:`, error);
      }
    }
  } catch (error) {
    console.error("Error searching indexes:", error);
  }

  return results.slice(0, 10);
}

// Search calendar events
async function searchCalendarEvents(query: string): Promise<CalendarEventSearchResult[]> {
  const results: CalendarEventSearchResult[] = [];
  
  try {
    // Search through calendar events collection
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/events?search=${encodeURIComponent(query)}&limit=5`);
    if (response.ok) {
      const data = await response.json();
      if (data.events) {
        results.push(...data.events.map((event: any) => ({
          type: "calendar" as const,
          id: event.id,
          projectId: event.projectId,
          projectName: event.projectName,
          projectTicker: event.projectTicker,
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          eventType: event.eventType,
          status: event.status,
          votes: event.votes || 0
        })));
      }
    }
  } catch (error) {
    console.error("Error searching calendar events:", error);
  }

  return results;
}

// Search wallet information
async function searchWallet(address: string): Promise<WalletSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Get wallet balance
    const balance = await provider.getBalance(address);
    
    // Get transaction count
    const transactionCount = await provider.getTransactionCount(address);
    
    // Get latest transaction for last activity
    const latestBlock = await provider.getBlockNumber();
    let lastActivity = null;
    
    try {
      // Try to get the latest transaction involving this address
      const filter = {
        fromBlock: latestBlock - 1000, // Last 1000 blocks
        toBlock: latestBlock,
        address: address
      };
      
      const logs = await provider.getLogs(filter);
      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1];
        const block = await provider.getBlock(latestLog.blockNumber);
        lastActivity = new Date(block?.timestamp ? block.timestamp * 1000 : Date.now()).toISOString();
      }
    } catch (error) {
      console.error("Error getting last activity:", error);
    }
    
    return {
      type: "wallet",
      address,
      balance: ethers.formatEther(balance),
      transactionCount: transactionCount,
      lastActivity
    };
  } catch (error) {
    console.error("Error searching wallet:", error);
    return null;
  }
}

// Search transaction information
async function searchTransaction(hash: string): Promise<TransactionSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) return null;
    
    // Get transaction details
    const tx = await provider.getTransaction(hash);
    
    // Get block for timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    
    return {
      type: "transaction",
      hash,
      blockNumber: receipt.blockNumber || undefined,
      from: receipt.from,
      to: receipt.to || "",
      value: tx?.value ? ethers.formatEther(tx.value) : undefined,
      status: receipt.status || undefined,
      timestamp: block?.timestamp ? block.timestamp * 1000 : undefined
    };
  } catch (error) {
    console.error("Error searching transaction:", error);
    return null;
  }
}

// Search block information
async function searchBlock(numberOrHash: string): Promise<BlockSearchResult | null> {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    let block;
    if (isBlockNumber(numberOrHash)) {
      block = await provider.getBlock(parseInt(numberOrHash));
    } else {
      block = await provider.getBlock(numberOrHash);
    }
    
    if (!block) return null;
    
    return {
      type: "block",
      number: block.number,
      hash: block.hash,
      timestamp: block.timestamp ? block.timestamp * 1000 : undefined,
      transactions: block.transactions.length,
      gasUsed: block.gasUsed?.toString(),
      gasLimit: block.gasLimit?.toString()
    };
  } catch (error) {
    console.error("Error searching block:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Query parameter 'q' is required"
      }, { status: 400 });
    }

    const results: SearchResult = {
      tokens: [],
      wallets: [],
      transactions: [],
      blocks: [],
      news: [],
      indexes: [],
      calendar: []
    };

    // Determine query type and search accordingly
    if (isEthereumAddress(query)) {
      // Search for wallet
      const walletResult = await searchWallet(query);
      if (walletResult) {
        results.wallets.push(walletResult);
      }
      
      // Also search for tokens with this address
      const tokenResults = await searchTokens(query);
      results.tokens.push(...tokenResults);
      
    } else if (isTransactionHash(query)) {
      // Search for transaction
      const txResult = await searchTransaction(query);
      if (txResult) {
        results.transactions.push(txResult);
      }
      
    } else if (isBlockNumber(query)) {
      // Search for block
      const blockResult = await searchBlock(query);
      if (blockResult) {
        results.blocks.push(blockResult);
      }
      
    } else {
      // Search for tokens by name/symbol
      const tokenResults = await searchTokens(query);
      results.tokens.push(...tokenResults);
      
      // Search for news articles
      const newsResults = await searchNews(query);
      results.news.push(...newsResults);
      
      // Search for index data
      const indexResults = await searchIndexes(query);
      results.indexes.push(...indexResults);
      
      // Search for calendar events
      const calendarResults = await searchCalendarEvents(query);
      results.calendar.push(...calendarResults);
      
      // If query looks like a block number, try searching for it
      if (isBlockNumber(query)) {
        const blockResult = await searchBlock(query);
        if (blockResult) {
          results.blocks.push(blockResult);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      query,
      results,
      totalResults: results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + results.news.length + results.indexes.length + results.calendar.length
    });
    
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to perform search"
    }, { status: 500 });
  }
}
