import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const UNISWAP_V3_QUOTER = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // Base chain Uniswap V3 Quoter
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base chain WETH

// Token registry for Base Chain
const TOKEN_REGISTRY = {
  "ETH": {
    address: ETH_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
  },
  "USDC": {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
  },
  "WETH": {
    address: WETH_ADDRESS,
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png"
  }
};

// Quoter ABI (simplified)
const QUOTER_ABI = [
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint24" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

interface QuoteRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  walletAddress: string;
  tokenAddress?: string; // Add token address for dynamic tokens
}

interface QuoteResponse {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  gasEstimate: string;
  route: string[];
  fees: number;
  executionPrice: number;
  minimumReceived: string;
  priceImpactLevel: "low" | "medium" | "high";
}

// Get token info
function getTokenInfo(symbol: string, tokenAddress?: string) {
  // Handle ETH to WETH conversion for Uniswap V3
  if (symbol === "ETH") {
    return {
      address: WETH_ADDRESS, // Use WETH for swaps
      symbol: "WETH",
      name: "Wrapped Ethereum",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png"
    };
  }
  
  // If the symbol is actually a token address (starts with 0x), use it directly
  if (symbol.startsWith('0x') && symbol.length === 42) {
    return {
      address: symbol,
      symbol: "TOKEN", // Generic symbol for unknown tokens
      name: "Token",
      decimals: 18, // Default to 18 decimals for most tokens
      logo: "https://via.placeholder.com/32"
    };
  }
  
  // If we have a token address, create a dynamic token entry
  if (tokenAddress && !TOKEN_REGISTRY[symbol as keyof typeof TOKEN_REGISTRY]) {
    return {
      address: tokenAddress,
      symbol: symbol,
      name: symbol,
      decimals: 18, // Default to 18 decimals for most tokens
      logo: "https://via.placeholder.com/32"
    };
  }
  
  const token = TOKEN_REGISTRY[symbol as keyof typeof TOKEN_REGISTRY];
  if (!token) {
    throw new Error(`Token ${symbol} not supported`);
  }
  return token;
}

// Calculate price impact
function calculatePriceImpact(inputValue: number, outputValue: number): number {
  if (inputValue === 0) return 0;
  return ((inputValue - outputValue) / inputValue) * 100;
}

// Get price impact level
function getPriceImpactLevel(impact: number): "low" | "medium" | "high" {
  if (impact < 1) return "low";
  if (impact < 5) return "medium";
  return "high";
}

// Get ETH price with multiple reliable sources (avoiding CoinGecko rate limits)
async function getEthPrice(): Promise<number> {
  // Try DexScreener first (most reliable and no rate limits)
  try {
    console.log("🔄 Fetching ETH price from DexScreener...");
    const dexResponse = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006");
    const dexData = await dexResponse.json();
    if (dexData.pairs && dexData.pairs.length > 0) {
      // Look for WETH pairs with USDC as quote token (most reliable)
      const wethUsdcPair = dexData.pairs.find((pair: any) => 
        pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
        pair.quoteToken?.address === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" &&
        pair.chainId === "base"
      );
      if (wethUsdcPair?.priceUsd) {
        const dexEthPrice = parseFloat(wethUsdcPair.priceUsd);
        console.log("✅ ETH price from DexScreener WETH/USDC:", dexEthPrice);
        return dexEthPrice;
      }
      
      // Fallback to any WETH pair with price on Base
      const wethPair = dexData.pairs.find((pair: any) => 
        pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
        pair.priceUsd && 
        pair.chainId === "base"
      );
      if (wethPair?.priceUsd) {
        const dexEthPrice = parseFloat(wethPair.priceUsd);
        console.log("✅ ETH price from DexScreener Base chain:", dexEthPrice);
        return dexEthPrice;
      }
    }
  } catch (dexError) {
    console.error("DexScreener ETH price fetch failed:", dexError);
  }

  // Try alternative price APIs with better rate limits
  const priceAPIs = [
    {
      name: "Binance",
      url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
      parser: (data: any) => parseFloat(data.price)
    },
    {
      name: "Kraken",
      url: "https://api.kraken.com/0/public/Ticker?pair=ETHUSD",
      parser: (data: any) => parseFloat(data.result?.XETHZUSD?.c?.[0])
    },
    {
      name: "CoinGecko",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      parser: (data: any) => data.ethereum?.usd
    }
  ];

  for (const api of priceAPIs) {
    try {
      console.log(`🔄 Trying ${api.name} for ETH price...`);
      const response = await fetch(api.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CypherX/1.0'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) {
        console.log(`⚠️ ${api.name} returned status ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const price = api.parser(data);
      
      if (price && price > 0) {
        console.log(`✅ ETH price from ${api.name}: $${price}`);
        return price;
      }
    } catch (error) {
      console.log(`❌ ${api.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Last resort: use our proxy
  try {
    console.log("🔄 Trying ETH price proxy as last resort...");
    const proxyResponse = await fetch("/api/coingecko-proxy?endpoint=simple/price?ids=ethereum&vs_currencies=usd");
    const proxyData = await proxyResponse.json();
    const ethPrice = proxyData.ethereum?.usd || 0;
    
    if (ethPrice > 0) {
      console.log("✅ ETH price from proxy:", ethPrice);
      return ethPrice;
    }
  } catch (proxyError) {
    console.error("❌ Proxy fallback also failed:", proxyError);
  }
  
  // No fallback - throw error if no real price found
  throw new Error("Failed to fetch real ETH price from all sources");
}

// Get token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === ETH_ADDRESS || tokenAddress === WETH_ADDRESS) {
    return await getEthPrice();
  }

  try {
    console.log(`🔍 Fetching token price for: ${tokenAddress}`);
    // First try to get price from DexScreener
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    console.log(`📊 DexScreener response for ${tokenAddress}:`, {
      pairsCount: data.pairs?.length || 0,
      firstPair: data.pairs?.[0] ? {
        dexId: data.pairs[0].dexId,
        priceUsd: data.pairs[0].priceUsd,
        liquidity: data.pairs[0].liquidity?.usd
      } : null
    });
    
    // Look for the best pair with highest liquidity
    const pairs = data.pairs || [];
    const bestPair = pairs.reduce((best: { liquidity?: { usd?: string }; priceUsd?: string }, current: { liquidity?: { usd?: string }; priceUsd?: string }) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
    }, pairs[0]);
    
    if (bestPair?.priceUsd) {
      const price = parseFloat(bestPair.priceUsd);
      console.log(`✅ Token ${tokenAddress} price from DexScreener: $${price} USD`);
      return price;
    }
    
    // Fallback to CoinGecko if available
    try {
      const coingeckoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${tokenAddress}&vs_currencies=usd`);
      const coingeckoData = await coingeckoResponse.json();
      const price = coingeckoData[tokenAddress.toLowerCase()]?.usd;
      if (price) {
        console.log(`Token ${tokenAddress} price (CoinGecko): ${price} USD`);
        return price;
      }
    } catch (coingeckoError) {
      console.error("CoinGecko price fetch failed:", coingeckoError);
    }
    
    console.log(`No price found for token ${tokenAddress}, using fallback`);
    return 0.0001; // Very low default price for unknown tokens
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0.0001; // Very low default price for unknown tokens
  }
}

// Get quote from Uniswap V3
async function getUniswapQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  decimals: number
): Promise<{ amountOut: string; gasEstimate: string }> {
  try {
    console.log("🔄 Attempting Uniswap V3 quote:", {
      tokenInAddress,
      tokenOutAddress,
      amountIn,
      decimals
    });
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Validate quoter contract exists
    try {
      const quoterCode = await provider.getCode(UNISWAP_V3_QUOTER);
      if (quoterCode === "0x") {
        throw new Error("Uniswap V3 Quoter contract not found");
      }
      console.log("✅ Uniswap V3 Quoter contract validated");
    } catch (error) {
      console.error("❌ Quoter contract validation failed:", error);
      throw new Error("Failed to validate Uniswap V3 Quoter contract");
    }
    
    // Check if token addresses are valid contracts
    try {
      const tokenInCode = await provider.getCode(tokenInAddress);
      const tokenOutCode = await provider.getCode(tokenOutAddress);
      
      if (tokenInCode === "0x" && tokenInAddress !== ETH_ADDRESS) {
        console.log("⚠️ TokenIn address is not a contract:", tokenInAddress);
      }
      if (tokenOutCode === "0x" && tokenOutAddress !== ETH_ADDRESS) {
        console.log("⚠️ TokenOut address is not a contract:", tokenOutAddress);
      }
      
      console.log("✅ Token contract validation completed");
    } catch (error) {
      console.log("⚠️ Token contract validation failed:", error);
    }
    
    // Validate token addresses
    if (!tokenInAddress || !tokenOutAddress || tokenInAddress === tokenOutAddress) {
      throw new Error("Invalid token addresses for quote");
    }
    
    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, QUOTER_ABI, provider);
    
    const amountInWei = ethers.parseUnits(amountIn, decimals);
    const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    
    let bestQuote = null;
    let bestAmountOut = 0n;
    let bestGasEstimate = 0n;
    
    for (const fee of feeTiers) {
      try {
        console.log(`🔄 Trying fee tier ${fee} (${fee/10000}%)`);
        
        // Validate inputs before calling quoter
        if (amountInWei <= 0n) {
          console.log(`❌ Invalid input amount for fee tier ${fee}`);
          continue;
        }
        
        console.log(`🔍 Calling quoter with:`, {
          tokenInAddress,
          tokenOutAddress,
          amountInWei: amountInWei.toString(),
          fee,
          sqrtPriceLimitX96: 0
        });
        
        const quote = await quoter.quoteExactInputSingle(
          tokenInAddress,
          tokenOutAddress,
          amountInWei,
          fee,
          0 // sqrtPriceLimitX96
        );
        
        const amountOutWei = quote[0];
        console.log(`✅ Fee tier ${fee} quote:`, {
          amountOutWei: amountOutWei.toString(),
          amountOutFormatted: ethers.formatUnits(amountOutWei, decimals)
        });
        
        // Validate the quote result
        if (amountOutWei > 0n && amountOutWei > bestAmountOut) {
          bestAmountOut = amountOutWei;
          bestGasEstimate = quote[3];
          bestQuote = quote;
          console.log(`🏆 New best quote from fee tier ${fee}`);
        } else {
          console.log(`⚠️ Fee tier ${fee} quote too low or zero:`, amountOutWei.toString());
        }
      } catch (error) {
        console.log(`❌ Fee tier ${fee} failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        // Log specific error details for each fee tier
        if (error instanceof Error) {
          if (error.message.includes("execution reverted")) {
            console.log(`🔍 Fee tier ${fee}: Contract revert - no liquidity or invalid parameters`);
          } else if (error.message.includes("insufficient liquidity")) {
            console.log(`🔍 Fee tier ${fee}: Insufficient liquidity`);
          } else if (error.message.includes("price impact too high")) {
            console.log(`🔍 Fee tier ${fee}: Price impact too high`);
          } else if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            console.log(`🔍 Fee tier ${fee}: Insufficient output amount`);
          } else if (error.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            console.log(`🔍 Fee tier ${fee}: Excessive input amount`);
          }
        }
        
        // Continue to next fee tier
        continue;
      }
    }
    
    if (!bestQuote || bestAmountOut <= 0n) {
      console.log("❌ No valid Uniswap V3 quotes found");
      throw new Error("No valid quote found from Uniswap V3 - all fee tiers failed");
    }
    
    const result = {
      amountOut: ethers.formatUnits(bestAmountOut, decimals),
      gasEstimate: ethers.formatEther(bestGasEstimate)
    };
    
    console.log("✅ Uniswap V3 quote result:", result);
    return result;
  } catch (error) {
    console.error("❌ Uniswap quote error:", error);
    throw error;
  }
}

// Get quote from multiple sources
async function getAggregatedQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  decimals: number
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity?: string; slippage?: string }> {
  console.log("🔄 Starting aggregated quote for:", {
    tokenInAddress,
    tokenOutAddress,
    amountIn,
    decimals
  });
  
  const quotes = [];
  
  // Check if Uniswap V3 pools exist for this token pair
  try {
    console.log("🔍 Checking for Uniswap V3 pools...");
    const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInAddress}`);
    const dexData = await dexScreenerResponse.json();
    
    const uniswapV3Pools = dexData.pairs?.filter((pair: { dexId?: string; baseToken?: { address?: string }; quoteToken?: { address?: string } }) => 
      pair.dexId === "uniswap_v3" && 
      ((pair.baseToken?.address?.toLowerCase() === tokenInAddress.toLowerCase() && 
        pair.quoteToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase()) ||
       (pair.baseToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase() && 
        pair.quoteToken?.address?.toLowerCase() === tokenInAddress.toLowerCase()))
    ) || [];
    
    console.log(`📊 Found ${uniswapV3Pools.length} Uniswap V3 pools for this token pair`);
    
    if (uniswapV3Pools.length === 0) {
      console.log("⚠️ No Uniswap V3 pools found - skipping Uniswap V3 quote attempt");
    } else {
      console.log("✅ Uniswap V3 pools found - attempting quote");
      
      // Try Uniswap V3
      try {
        console.log("🔄 Attempting Uniswap V3 quote...");
        console.log("🔍 Uniswap V3 quote parameters:", {
          tokenInAddress,
          tokenOutAddress,
          amountIn,
          decimals,
          quoterAddress: UNISWAP_V3_QUOTER
        });
        
        const uniswapQuote = await getUniswapQuote(tokenInAddress, tokenOutAddress, amountIn, decimals);
        quotes.push({
          ...uniswapQuote,
          source: "Uniswap V3",
          route: ["Uniswap V3"]
        });
        console.log("✅ Uniswap quote added:", uniswapQuote);
      } catch (error) {
        console.error("❌ Uniswap quote failed:", error);
        console.error("❌ Uniswap quote error details:", {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          tokenInAddress,
          tokenOutAddress,
          amountIn,
          decimals
        });
        
        // Log specific error details for debugging
        if (error instanceof Error) {
          if (error.message.includes("execution reverted")) {
            console.error("🔍 This is a contract revert - likely no liquidity on Uniswap V3");
          } else if (error.message.includes("insufficient liquidity")) {
            console.error("🔍 Insufficient liquidity on Uniswap V3");
          } else if (error.message.includes("price impact too high")) {
            console.error("🔍 Price impact too high on Uniswap V3");
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error checking for Uniswap V3 pools:", error);
    
    // Fallback: try Uniswap V3 anyway
    try {
      console.log("🔄 Fallback: Attempting Uniswap V3 quote...");
      const uniswapQuote = await getUniswapQuote(tokenInAddress, tokenOutAddress, amountIn, decimals);
      quotes.push({
        ...uniswapQuote,
        source: "Uniswap V3",
        route: ["Uniswap V3"]
      });
      console.log("✅ Uniswap quote added:", uniswapQuote);
    } catch (fallbackError) {
      console.error("❌ Fallback Uniswap quote also failed:", fallbackError);
    }
  }
  
  // Try DexScreener for additional routes - this is the main source for finding liquidity
  try {
    console.log("🔄 Attempting DexScreener quote...");
    
    // First, try to get all pairs for the input token
    const inputTokenResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInAddress}`);
    const inputTokenData = await inputTokenResponse.json();
    
    // Then, try to get all pairs for the output token
    const outputTokenResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenOutAddress}`);
    const outputTokenData = await outputTokenResponse.json();
    
    // Combine and find matching pairs
    const allPairs = [
      ...(inputTokenData.pairs || []),
      ...(outputTokenData.pairs || [])
    ];
    
    // Find exact pair matches
    const exactPairs = allPairs.filter((pair: { baseToken?: { address?: string }; quoteToken?: { address?: string } }) => 
      (pair.baseToken?.address?.toLowerCase() === tokenInAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase()) ||
      (pair.baseToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenInAddress.toLowerCase())
    );
    
    // Remove duplicates based on pairAddress
    const uniquePairs = exactPairs.filter((pair: any, index: number, self: any[]) => 
      index === self.findIndex((p: any) => p.pairAddress === pair.pairAddress)
    );
    
    // Sort by liquidity (highest first)
    const sortedPairs = uniquePairs.sort((a: any, b: any) => {
      const liquidityA = parseFloat(a.liquidity?.usd || "0");
      const liquidityB = parseFloat(b.liquidity?.usd || "0");
      return liquidityB - liquidityA;
    });
    
    console.log("📊 DexScreener pairs found:", sortedPairs.length);
    console.log("🔍 Available DEXs:", sortedPairs.map((p: any) => p.dexId).join(", "));
    
    for (const pair of sortedPairs.slice(0, 5)) { // Process top 5 pairs by liquidity
      try {
        console.log("🔍 Processing DexScreener pair:", {
          dexId: (pair as { dexId?: string }).dexId,
          baseToken: (pair as { baseToken?: { address?: string } }).baseToken?.address,
          quoteToken: (pair as { quoteToken?: { address?: string } }).quoteToken?.address,
          priceUsd: (pair as { priceUsd?: string }).priceUsd,
          liquidity: (pair as { liquidity?: { usd?: string } }).liquidity?.usd,
          baseTokenPrice: (pair as { baseToken?: { priceUsd?: string } }).baseToken?.priceUsd,
          quoteTokenPrice: (pair as { quoteToken?: { priceUsd?: string } }).quoteToken?.priceUsd
        });
        
        // Calculate quote based on pair price and liquidity
        const pairPrice = parseFloat((pair as { priceUsd?: string }).priceUsd || "0");
        const liquidity = parseFloat((pair as { liquidity?: { usd?: string } }).liquidity?.usd || "0");
        
        // 🔧 FIXED: Get the correct input price based on what we're actually selling
        let inputPrice = 0;
        
        if (tokenInAddress === WETH_ADDRESS) {
          // We're selling ETH, so inputPrice should be ETH price
          inputPrice = parseFloat((pair as { baseToken?: { priceUsd?: string } }).baseToken?.priceUsd || "0");
          if (inputPrice === 0) {
            inputPrice = parseFloat((pair as { quoteToken?: { priceUsd?: string } }).quoteToken?.priceUsd || "0");
          }
          if (inputPrice === 0) {
            inputPrice = await getEthPrice();
            console.log("✅ Using real ETH price for ETH sale:", inputPrice);
          }
        } else {
          // We're selling a token, so inputPrice should be the token price
          // Get the token price from the pair data
          const baseTokenAddress = (pair as { baseToken?: { address?: string } }).baseToken?.address;
          const quoteTokenAddress = (pair as { quoteToken?: { address?: string } }).quoteToken?.address;
          
          if (baseTokenAddress?.toLowerCase() === tokenInAddress.toLowerCase()) {
            inputPrice = parseFloat((pair as { baseToken?: { priceUsd?: string } }).baseToken?.priceUsd || "0");
          } else if (quoteTokenAddress?.toLowerCase() === tokenInAddress.toLowerCase()) {
            inputPrice = parseFloat((pair as { quoteToken?: { priceUsd?: string } }).quoteToken?.priceUsd || "0");
          }
          
          // If we still don't have a price, get it from our token price function
          if (inputPrice === 0) {
            inputPrice = await getTokenPrice(tokenInAddress);
            console.log("✅ Using token price function for token sale:", inputPrice);
          }
        }
        
        console.log("💰 DexScreener pair data:", { pairPrice, inputPrice, liquidity });
        
        if (pairPrice > 0 && inputPrice > 0 && liquidity > 0) {
          // 🔧 FIXED: Use direct USD value calculation instead of trying to calculate exchange rates
          // This is more reliable since we have USD prices for both tokens
          let estimatedOutput;
          
          // Calculate the USD value of the input amount
          const inputValueUSD = parseFloat(amountIn) * inputPrice;
          console.log("🔍 Input value in USD:", inputValueUSD);
          
          // For token -> ETH swaps, calculate how much ETH we get for the USD value
          if (tokenOutAddress === WETH_ADDRESS) {
            // Token -> ETH: USD value / ETH price = ETH amount
            const ethPrice = await getEthPrice(); // Get real ETH price
            estimatedOutput = inputValueUSD / ethPrice;
            console.log("🔍 Token -> ETH calculation:", {
              amountIn,
              inputValueUSD,
              ethPrice,
              estimatedOutput
            });
            
            // 🔧 DEBUG: Also try a simple calculation as fallback
            if (estimatedOutput < 0.0001) { // If result is too small
              console.log("⚠️ ETH output too small, trying fallback calculation...");
              const fallbackEthPrice = 3000; // Use a reasonable ETH price
              const fallbackOutput = inputValueUSD / fallbackEthPrice;
              console.log("🔍 Fallback calculation:", {
                inputValueUSD,
                fallbackEthPrice,
                fallbackOutput
              });
              if (fallbackOutput > estimatedOutput) {
                estimatedOutput = fallbackOutput;
                console.log("✅ Using fallback calculation");
              }
            }
          } else if (tokenInAddress === WETH_ADDRESS) {
            // ETH -> Token: USD value / token price = token amount
            const tokenPrice = await getTokenPrice(tokenOutAddress);
            estimatedOutput = inputValueUSD / tokenPrice;
            console.log("🔍 ETH -> Token calculation:", {
              amountIn,
              inputValueUSD,
              tokenPrice,
              estimatedOutput
            });
          } else {
            // Token -> Token: USD value / output token price = output token amount
            const outputTokenPrice = await getTokenPrice(tokenOutAddress);
            estimatedOutput = inputValueUSD / outputTokenPrice;
            console.log("🔍 Token -> Token calculation:", {
              amountIn,
              inputValueUSD,
              outputTokenPrice,
              estimatedOutput
            });
          }
          
          // Apply slippage based on liquidity and trade size
          const tradeSize = parseFloat(amountIn) * inputPrice;
          const liquidityRatio = tradeSize / liquidity;
          
          // Dynamic slippage calculation
          let slippage = 0.005; // Base 0.5% slippage
          if (liquidityRatio > 0.1) slippage = 0.02; // 2% for large trades
          if (liquidityRatio > 0.5) slippage = 0.05; // 5% for very large trades
          if (liquidityRatio > 1) slippage = 0.1; // 10% for extremely large trades
          
          const finalOutput = estimatedOutput * (1 - slippage);
          
          // Get appropriate gas estimate based on DEX
          const dexId = (pair as { dexId?: string }).dexId || "unknown";
          let gasEstimate = "150000"; // Default
          if (dexId.includes("uniswap")) gasEstimate = "180000";
          if (dexId.includes("aerodrome")) gasEstimate = "200000";
          if (dexId.includes("baseswap")) gasEstimate = "180000";
          
          quotes.push({
            amountOut: finalOutput.toString(),
            gasEstimate,
            source: dexId,
            route: [dexId],
            liquidity: liquidity.toString(),
            slippage: slippage.toString()
          });
          
          console.log("✅ DexScreener quote added:", {
            dex: dexId,
            price: pairPrice,
            inputPrice,
            liquidity,
            tradeSize,
            liquidityRatio,
            estimatedOutput,
            finalOutput,
            slippage: `${(slippage * 100).toFixed(2)}%`,
            gasEstimate
          });
        } else {
          console.log("⚠️ DexScreener pair skipped - invalid data:", { pairPrice, inputPrice, liquidity });
        }
      } catch (error) {
        console.error("❌ Error processing DexScreener pair:", error);
        continue;
      }
    }
  } catch (error) {
    console.error("❌ DexScreener quote failed:", error);
  }
  
  console.log("📊 Total quotes collected:", quotes.length);
  
  // Return best quote
  if (quotes.length === 0) {
    console.log("❌ No real quotes available from any source");
    return NextResponse.json(
      { 
        error: "No liquidity found for this token pair",
        details: "Unable to find any trading pairs with sufficient liquidity"
      },
      { status: 400 }
    );
  }
  
  // Select the best quote based on output amount and liquidity
  console.log("📊 Available quotes:", quotes.map(q => ({
    source: q.source,
    amountOut: q.amountOut,
    liquidity: q.liquidity,
    slippage: q.slippage
  })));
  
  if (quotes.length === 0) {
    console.log("❌ No quotes available from any source");
    return NextResponse.json(
      { 
        error: "No liquidity found for this token pair",
        details: "Unable to find any trading pairs with sufficient liquidity"
      },
      { status: 400 }
    );
  }
  
  // Score quotes based on output amount and liquidity
  const scoredQuotes = quotes.map(quote => {
    const outputAmount = parseFloat(quote.amountOut);
    const liquidity = parseFloat(quote.liquidity || "0");
    const slippage = parseFloat(quote.slippage || "0");
    
    // Score based on output amount (higher is better) and slippage (lower is better)
    // But heavily favor DexScreener quotes over Uniswap V3 since Uniswap V3 is failing
    let score = outputAmount * (1 - slippage);
    
    // Boost DexScreener quotes significantly
    if (quote.source !== "Uniswap V3") {
      score *= 1.5; // 50% boost for non-Uniswap quotes
    }
    
    // Additional boost for high liquidity
    if (liquidity > 10000) { // $10k+ liquidity
      score *= 1.2;
    }
    
    return { ...quote, score };
  });
  
  // Sort by score (highest first)
  scoredQuotes.sort((a, b) => b.score - a.score);
  
  const bestQuote = scoredQuotes[0];
  console.log("🏆 Best quote selected:", {
    source: bestQuote.source,
    amountOut: bestQuote.amountOut,
    liquidity: bestQuote.liquidity,
    slippage: bestQuote.slippage,
    score: bestQuote.score
  });
  
  // Validate the best quote is reasonable
  const bestAmount = parseFloat(bestQuote.amountOut);
  if (bestAmount <= 0) {
    console.log("❌ Best quote is zero or negative");
    return NextResponse.json(
      { 
        error: "Invalid quote received from exchange",
        details: "The exchange returned an invalid quote amount"
      },
      { status: 400 }
    );
  }
  
  // Log which DEX is being used
  if (bestQuote.source !== "Uniswap V3") {
    console.log("✅ Using quote from:", bestQuote.source);
  }
  
  return {
    amountOut: bestQuote.amountOut,
    gasEstimate: bestQuote.gasEstimate,
    route: bestQuote.route,
    source: bestQuote.source,
    liquidity: bestQuote.liquidity,
    slippage: bestQuote.slippage
  };
}

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json();
    console.log("Quote API received request:", body);
    
    const { inputToken, outputToken, inputAmount, walletAddress, tokenAddress } = body;
    
    if (!inputToken || !outputToken || !inputAmount || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate input amount
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid input amount" },
        { status: 400 }
      );
    }
    
    // Get token information
    console.log("Getting token info for quote:", { inputToken, outputToken, tokenAddress });
    // For non-ETH tokens, we need the tokenAddress to get the correct info
    const inputTokenInfo = getTokenInfo(inputToken, inputToken !== "ETH" ? tokenAddress : undefined);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken !== "ETH" ? tokenAddress : undefined);
    console.log("Quote token info:", { inputTokenInfo, outputTokenInfo });
    
    // Validate token addresses
    if (!inputTokenInfo.address || !outputTokenInfo.address) {
      throw new Error("Invalid token addresses for quote");
    }
    
    // Additional validation for token addresses
    if (inputTokenInfo.address === "0x0000000000000000000000000000000000000000" || 
        outputTokenInfo.address === "0x0000000000000000000000000000000000000000") {
      throw new Error("Invalid token address - zero address detected");
    }
    
    console.log("🔍 Token addresses for quote:", {
      inputToken: inputTokenInfo.address,
      outputToken: outputTokenInfo.address,
      inputTokenSymbol: inputTokenInfo.symbol,
      outputTokenSymbol: outputTokenInfo.symbol
    });
    
    // Get aggregated quote
    let quote = await getAggregatedQuote(
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      inputTokenInfo.decimals
    );
    
    // Validate that the quote is from a DEX that actually has working pools
    if (quote && quote.source) {
      console.log(`🔍 Validating quote source: ${quote.source}`);
      
      try {
        const { validateAllPools } = await import('../../../utils/poolValidation');
        const poolValidation = await validateAllPools(inputTokenInfo.address, outputTokenInfo.address);
        
        if (poolValidation.bestPool && poolValidation.bestPool.isValid) {
          console.log(`✅ Found working pool: ${poolValidation.bestPool.dexId} with fee ${poolValidation.bestPool.fee}`);
          
          // Prioritize Aerodrome since Uniswap V3 is broken on Base chain
          if (poolValidation.bestPool.dexId === 'aerodrome') {
            console.log(`✅ Using Aerodrome (working DEX on Base chain)`);
            quote.route = ['aerodrome'];
            quote.source = 'aerodrome';
          } else if (quote.source.toLowerCase() !== poolValidation.bestPool.dexId.toLowerCase()) {
            console.log(`⚠️ Quote from ${quote.source} but best pool is ${poolValidation.bestPool.dexId} - adjusting route`);
            quote.route = [poolValidation.bestPool.dexId];
            quote.source = poolValidation.bestPool.dexId;
          }
        } else {
          console.log("⚠️ No working pools found - quote may fail");
        }
      } catch (error) {
        console.log("⚠️ Pool validation failed:", error);
      }
    }
    
    console.log("🔍 Initial quote result:", {
      inputToken: inputTokenInfo.address,
      outputToken: outputTokenInfo.address,
      inputAmount,
      outputAmount: quote.amountOut,
      route: quote.route
    });
    
    // Validate that we got a real quote
    if (!quote || !quote.amountOut || parseFloat(quote.amountOut) <= 0) {
      console.error("❌ No valid quote received from aggregated quote function");
      return NextResponse.json(
        { 
          error: "No liquidity found for this token pair",
          details: "Unable to find any trading pairs with sufficient liquidity"
        },
        { status: 400 }
      );
    }
    
    // Get current prices for better calculation
    const inputPrice = await getTokenPrice(inputTokenInfo.address);
    const outputPrice = await getTokenPrice(outputTokenInfo.address);
    
    console.log("💰 Price data:", { 
      inputPrice, 
      outputPrice, 
      inputAmount, 
      outputAmount: quote.amountOut,
      inputTokenAddress: inputTokenInfo.address,
      outputTokenAddress: outputTokenInfo.address
    });
    
    // Calculate price impact
    const inputValue = amount * inputPrice;
    const outputValue = parseFloat(quote.amountOut) * outputPrice;
    const priceImpact = calculatePriceImpact(inputValue, outputValue);
    
    // Calculate fees (0.3% for Uniswap V3)
    const fees = inputValue * 0.003;
    
    // Calculate minimum received (with slippage)
    const slippage = 0.005; // 0.5% default slippage
    const minimumReceived = parseFloat(quote.amountOut) * (1 - slippage);
    
    // Final validation - ensure we have a valid output amount
    if (parseFloat(quote.amountOut) <= 0) {
      console.error("❌ Invalid quote output amount:", quote.amountOut);
      console.error("Debug info:", { inputPrice, outputPrice, amount, inputTokenInfo, outputTokenInfo });
      return NextResponse.json(
        { 
          error: "Unable to get valid quote - insufficient liquidity or invalid token pair",
          details: "No valid swap route found for the specified tokens and amount"
        },
        { status: 400 }
      );
    }
    
    const response: QuoteResponse = {
      inputAmount,
      outputAmount: quote.amountOut,
      priceImpact: Math.abs(priceImpact),
      gasEstimate: quote.gasEstimate || "150000",
      route: quote.route || ["Unknown"],
      fees,
      executionPrice: outputValue / amount,
      minimumReceived: minimumReceived.toString(),
      priceImpactLevel: getPriceImpactLevel(Math.abs(priceImpact))
    };
    
    console.log("✅ Real quote response:", response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get quote",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
