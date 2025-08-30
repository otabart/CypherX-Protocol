// Utility functions for token price fetching with retry logic and error handling
import { ethers } from 'ethers';

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry fetch with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CypherX/1.0',
          ...options.headers,
        },
      });
      
      if (response.ok) {
        return response;
      }
      
      // If rate limited, wait longer and use different strategy
      if (response.status === 429) {
        const waitTime = Math.pow(2, i) * 2000; // Longer wait for rate limits
        console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${i + 1}`);
        await delay(waitTime);
        continue;
      }
      
      // For CORS errors, try with different headers
      if (response.status === 0 || response.status === 403) {
        console.log(`CORS/Forbidden error (${response.status}), trying with different headers`);
        try {
          const corsResponse = await fetch(url, {
            ...options,
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              ...options.headers,
            },
          });
          if (corsResponse.ok) {
            return corsResponse;
          }
        } catch (corsError) {
          console.log(`CORS retry failed:`, corsError);
        }
      }
      
      // For other errors, don't retry
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`Fetch failed, retrying in ${waitTime}ms (attempt ${i + 1}/${maxRetries})`);
      await delay(waitTime);
    }
  }
  throw new Error(`Failed to fetch after ${maxRetries} retries`);
}

// Get current token price from DexScreener
export async function getTokenPriceFromDexScreener(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetchWithRetry(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { cache: "no-store" }
    );
    
    if (response.ok) {
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Find the best pair with highest liquidity
      const bestPair = pairs.reduce((best: any, current: any) => {
        const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
        const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
        return currentLiquidity > bestLiquidity ? current : best;
      }, pairs[0]);
      
      if (bestPair?.priceUsd) {
        return parseFloat(bestPair.priceUsd);
      }
    }
    return null;
  } catch (error) {
    console.error(`Error fetching token price from DexScreener for ${tokenAddress}:`, error);
    return null;
  }
}

// Get current token price from CoinGecko
export async function getTokenPriceFromCoinGecko(tokenAddress: string): Promise<number | null> {
  try {
    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data[tokenAddress.toLowerCase()]?.usd;
      return price || null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching token price from CoinGecko for ${tokenAddress}:`, error);
    return null;
  }
}

// Get historical token price from CoinGecko
export async function getHistoricalTokenPrice(tokenAddress: string, timestamp: number): Promise<number | null> {
  try {
    const unixTimestamp = Math.floor(timestamp / 1000);
    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/ethereum/contract/${tokenAddress}/market_chart/range?vs_currency=usd&from=${unixTimestamp - 3600}&to=${unixTimestamp + 3600}`,
      { cache: "no-store" }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.prices && data.prices.length > 0) {
        // Find the closest price to the transaction timestamp
        const targetTime = timestamp;
        let closestPrice = data.prices[0][1]; // Default to first price
        let minDiff = Math.abs(data.prices[0][0] - targetTime);
        
        for (const [time, price] of data.prices) {
          const diff = Math.abs(time - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestPrice = price;
          }
        }
        
        return closestPrice;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error fetching historical price for ${tokenAddress} at ${timestamp}:`, error);
    return null;
  }
}

// Get token price with fallbacks
export async function getTokenPrice(tokenAddress: string, timestamp?: number): Promise<number> {
  // If timestamp is provided, try historical price first
  if (timestamp) {
    const historicalPrice = await getHistoricalTokenPrice(tokenAddress, timestamp);
    if (historicalPrice !== null) {
      return historicalPrice;
    }
  }
  
  // Try DexScreener first
  const dexScreenerPrice = await getTokenPriceFromDexScreener(tokenAddress);
  if (dexScreenerPrice !== null) {
    return dexScreenerPrice;
  }
  
  // Fallback to CoinGecko
  const coinGeckoPrice = await getTokenPriceFromCoinGecko(tokenAddress);
  if (coinGeckoPrice !== null) {
    return coinGeckoPrice;
  }
  
  // 🔧 NEW: Fallback to on-chain price calculation for WETH pairs
  try {
    const onChainPrice = await getOnChainTokenPrice(tokenAddress);
    if (onChainPrice !== null) {
      console.log(`✅ Using on-chain price for ${tokenAddress}: $${onChainPrice}`);
      return onChainPrice;
    }
  } catch (error) {
    console.log(`On-chain price calculation failed for ${tokenAddress}:`, error);
  }
  
  // If all else fails, return 0
  console.warn(`No price data available for token ${tokenAddress}`);
  return 0;
}

// Get on-chain token price using Uniswap V2 pair reserves
export async function getOnChainTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    // Only try for Base chain tokens
    const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
    const UNISWAP_V2_FACTORY = "0x8909dc15e40173ff4699343b6eb8132c65e18ec6";
    
    // Get ETH price first
    const ethPrice = await getEthPrice();
    if (ethPrice === 0) {
      console.log("Cannot calculate on-chain price without ETH price");
      return null;
    }
    
    // Try to get pair address from Uniswap V2 factory
    const factoryABI = ["function getPair(address tokenA, address tokenB) view returns (address pair)"];
    const pairABI = [
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
    ];
    
    const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");
    const factory = new ethers.Contract(UNISWAP_V2_FACTORY, factoryABI, provider);
    
    // Get pair address
    const pairAddress = await factory.getPair(tokenAddress, WETH_ADDRESS);
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      console.log(`No WETH pair found for token ${tokenAddress}`);
      return null;
    }
    
    // Get reserves
    const pair = new ethers.Contract(pairAddress, pairABI, provider);
    const [token0, _, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves()
    ]);
    
    const [reserve0, reserve1] = reserves;
    
    // Calculate price based on which token is token0
    if (token0.toLowerCase() === tokenAddress.toLowerCase()) {
      // token0 is the token, token1 is WETH
      if (reserve0 === 0n) return null;
      const tokenPrice = (Number(reserve1) / Number(reserve0)) * ethPrice;
      return tokenPrice;
    } else {
      // token1 is the token, token0 is WETH
      if (reserve1 === 0n) return null;
      const tokenPrice = (Number(reserve0) / Number(reserve1)) * ethPrice;
      return tokenPrice;
    }
  } catch (error) {
    console.error(`Error calculating on-chain price for ${tokenAddress}:`, error);
    return null;
  }
}

// Get ETH price
export async function getEthPrice(): Promise<number> {
  try {
    // Try CoinGecko first
    const response = await fetchWithRetry(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { cache: "no-store" }
    );
    
    if (response.ok) {
      const data = await response.json();
      const price = data.ethereum?.usd;
      if (price) {
        return price;
      }
    }
    
    // Fallback to DexScreener
    const dexScreenerPrice = await getTokenPriceFromDexScreener('0x4200000000000000000000000000000000000006'); // WETH on Base
    if (dexScreenerPrice !== null) {
      return dexScreenerPrice;
    }
    
    // Final fallback
    return 3000; // Default ETH price
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 3000; // Default fallback
  }
}

// Format USD value with proper abbreviation
export function formatUSDValue(value: number): string {
  if (value === 0) return '$0.00';
  
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  } else if (value >= 1) {
    return `$${value.toFixed(2)}`;
  } else {
    return `$${value.toFixed(6)}`;
  }
}

// Format percentage change
export function formatPercentageChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}
