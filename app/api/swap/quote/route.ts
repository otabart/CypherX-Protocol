import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// Base RPC URL for Base network
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";

// 🔧 ENHANCED: Comprehensive DEX and aggregator configuration
const DEX_CONFIGS = {
  // Aggregators (Priority 1 - Best execution)
  aggregators: {
    "0x": {
      name: "0x Protocol",
      priority: 1,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.5,
      gasEstimate: "150000",
      apiKey: process.env.ZEROX_API_KEY
    },
    "okx": {
      name: "OKX DEX Aggregator", 
      priority: 2,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.3,
      gasEstimate: "150000"
    },
    "1inch": {
      name: "1inch Aggregator",
      priority: 3,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.5,
      gasEstimate: "150000",
      apiKey: process.env.INCH_API_KEY
    },
    "paraswap": {
      name: "ParaSwap",
      priority: 4,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.5,
      gasEstimate: "150000"
    },
    "openocean": {
      name: "OpenOcean",
      priority: 5,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.5,
      gasEstimate: "150000"
    },
    "jupiter": {
      name: "Jupiter Aggregator",
      priority: 6,
      supports: ["ETH", "TOKEN"],
      maxSlippage: 0.5,
      gasEstimate: "150000"
    }
  },
  
  // Individual DEXes (Priority 2 - Direct execution)
  dexes: {
    "uniswap_v2": {
      name: "Uniswap V2",
      priority: 7,
      router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "300000"
    },
    "aerodrome": {
      name: "Aerodrome",
      priority: 8,
      router: "0xE9992487b2EE03b7a91241695A58E0ef3654643E",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "250000"
    },
    "baseswap": {
      name: "BaseSwap",
      priority: 9,
      router: "0xFD14567eaf9ba9b71d4a6b255d96842dEF71D2bE",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "250000"
    },
    "sushiswap": {
      name: "SushiSwap",
      priority: 10,
      router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "250000"
    },
    "pancakeswap": {
      name: "PancakeSwap",
      priority: 11,
      router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "250000"
    },
    "velodrome": {
      name: "Velodrome",
      priority: 12,
      router: "0xE9992487b2EE03b7a91241695A58E0ef3654643E",
      supports: ["ETH", "TOKEN"],
      maxSlippage: 1.0,
      gasEstimate: "250000"
    }
  }
};

interface QuoteRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  walletAddress: string;
  tokenAddress?: string;
  preferredDex?: string;
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
  dexUsed: string;
  liquidity: string;
  slippage: number;
  // 🔧 ENHANCED: Additional quote comparison data
  allQuotes?: Array<{
    source: string;
    name: string;
    amountOut: string;
    gasEstimate: string;
    priceImpact: number;
    liquidity: string;
    slippage: number;
    priority: number;
  }>;
  bestQuote?: {
    source: string;
    name: string;
    reason: string;
  };
}

// Get token info
function getTokenInfo(symbol: string, tokenAddress?: string) {
  if (symbol === "ETH") {
    return {
      address: WETH_ADDRESS,
      symbol: "WETH",
      name: "Wrapped Ethereum",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png"
    };
  }
  
  if (tokenAddress && !tokenAddress.startsWith('0x')) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
  
  if (tokenAddress) {
    return {
      address: tokenAddress,
      symbol: symbol,
      name: symbol,
      decimals: 18,
      logo: "https://via.placeholder.com/32"
    };
  }
  
  throw new Error(`Token ${symbol} not supported - token address required`);
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

// Get ETH price from CoinGecko
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      const data = await response.json();
    return data.ethereum?.usd || 2000;
    } catch (error) {
    console.log("Using fallback ETH price: $2000");
    return 2000;
  }
}

// Get token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === WETH_ADDRESS) {
    return await getEthPrice();
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const bestPair = data.pairs.reduce((best: any, current: any) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
      }, data.pairs[0]);
    
    if (bestPair?.priceUsd) {
        const price = parseFloat(bestPair.priceUsd);
        console.log(`✅ Token ${tokenAddress} price from DexScreener: $${price} USD`);
        return price;
      }
    }
    
    console.log(`No price found for token ${tokenAddress}, using fallback`);
    return 0.0001; // Very low default price for unknown tokens
  } catch (error) {
    console.log("Error fetching token price:", error);
    return 0.0001; // Very low default price for unknown tokens
  }
}

// 🔧 ENHANCED: 0x Protocol Integration with better error handling
async function get0xQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting 0x Protocol quote...");
    
    // 0x API endpoint for Base chain
    const apiUrl = `https://api.0x.org/swap/v1/quote?buyToken=${tokenOutAddress}&sellToken=${tokenInAddress}&sellAmount=${ethers.parseUnits(amountIn, 18).toString()}&slippagePercentage=0.5&excludedSources=Uniswap_V3&includedSources=Uniswap_V2,Aerodrome,BaseSwap`;
    
    console.log("🔍 0x API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        '0x-api-key': process.env.ZEROX_API_KEY || 'test'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ 0x API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.buyAmount) {
      const amountOut = ethers.formatUnits(data.buyAmount, 18);
      console.log(`✅ 0x quote: ${amountOut} tokens for ${amountIn} input`);
        
        return {
        amountOut,
        gasEstimate: data.gas || "150000",
        route: ["0x_protocol"],
        source: "0x",
        liquidity: "15000",
        slippage: 0.005
      };
    } else {
      console.log("⚠️ 0x API response missing buyAmount:", data);
    }
    
    return null;
  } catch (error) {
    console.log("❌ 0x quote failed:", error);
    return null;
  }
}

// 🔧 ENHANCED: OKX DEX Aggregator Integration
async function getOkxQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting OKX DEX aggregator quote...");
    
    // OKX uses WETH for ETH swaps
    const actualTokenIn = tokenInAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ? "0x4200000000000000000000000000000000000006" : tokenInAddress;
    const actualTokenOut = tokenOutAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ? "0x4200000000000000000000000000000000000006" : tokenOutAddress;
    
    // Convert amount to wei
    const amountInWei = ethers.parseUnits(amountIn, 18).toString();
    
    // OKX API endpoint for Base chain
    const apiUrl = `https://www.okx.com/api/v5/dex/aggregator/quote?chainId=8453&fromToken=${actualTokenIn}&toToken=${actualTokenOut}&amount=${amountInWei}&userAddress=0x1234567890123456789012345678901234567890`;
    
    console.log("🔍 OKX API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ OKX API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code === "0" && data.data && data.data.length > 0) {
      const bestQuote = data.data[0];
      const amountOut = ethers.formatUnits(bestQuote.toAmount, 18);
      
      console.log(`✅ OKX quote: ${amountOut} tokens for ${amountIn} input`);
      
      return {
        amountOut,
        gasEstimate: bestQuote.gas || "150000",
        route: ["okx_aggregator"],
        source: "okx",
        liquidity: "20000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ OKX quote failed:", error);
    return null;
  }
}

// 🔧 ENHANCED: 1inch Aggregator Integration
async function get1inchQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting 1inch aggregator quote...");
    
    // 1inch API endpoint for Base chain
    const apiUrl = `https://api.1inch.dev/swap/v5.2/8453/quote?src=${tokenInAddress}&dst=${tokenOutAddress}&amount=${ethers.parseUnits(amountIn, 18).toString()}&slippage=0.5`;
    
    console.log("🔍 1inch API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.INCH_API_KEY || 'test'}`
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ 1inch API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.toAmount) {
      const amountOut = ethers.formatUnits(data.toAmount, 18);
      console.log(`✅ 1inch quote: ${amountOut} tokens for ${amountIn} input`);
      
      return {
        amountOut,
        gasEstimate: data.gas || "150000",
        route: ["1inch_aggregator"],
        source: "1inch",
        liquidity: "25000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ 1inch quote failed:", error);
    return null;
  }
}

// 🔧 NEW: ParaSwap Aggregator Integration
async function getParaSwapQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting ParaSwap aggregator quote...");
    
    // ParaSwap API endpoint for Base chain
    const apiUrl = `https://apiv5.paraswap.io/prices/?srcToken=${tokenInAddress}&destToken=${tokenOutAddress}&amount=${ethers.parseUnits(amountIn, 18).toString()}&srcDecimals=18&destDecimals=18&side=SELL&network=8453`;
    
    console.log("🔍 ParaSwap API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ ParaSwap API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.priceRoute && data.priceRoute.blockNumber) {
      const amountOut = ethers.formatUnits(data.priceRoute.destAmount, 18);
      console.log(`✅ ParaSwap quote: ${amountOut} tokens for ${amountIn} input`);
      
      return {
        amountOut,
        gasEstimate: data.priceRoute.gasCost || "150000",
        route: ["paraswap_aggregator"],
        source: "paraswap",
        liquidity: "30000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ ParaSwap quote failed:", error);
    return null;
  }
}

// 🔧 NEW: OpenOcean Aggregator Integration
async function getOpenOceanQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting OpenOcean aggregator quote...");
    
    // OpenOcean API endpoint for Base chain
    const apiUrl = `https://open-api.openocean.finance/v3/8453/quote?inToken=${tokenInAddress}&outToken=${tokenOutAddress}&amount=${ethers.parseUnits(amountIn, 18).toString()}&gasPrice=2000000000&slippage=0.5`;
    
    console.log("🔍 OpenOcean API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ OpenOcean API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.data && data.data.outAmount) {
      const amountOut = ethers.formatUnits(data.data.outAmount, 18);
      console.log(`✅ OpenOcean quote: ${amountOut} tokens for ${amountIn} input`);
      
      return {
        amountOut,
        gasEstimate: data.data.gas || "150000",
        route: ["openocean_aggregator"],
        source: "openocean",
        liquidity: "35000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ OpenOcean quote failed:", error);
    return null;
  }
}

// 🔧 NEW: Jupiter Aggregator Integration
async function getJupiterQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting Jupiter aggregator quote...");
    
    // Jupiter API endpoint for Base chain (if supported)
    const apiUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenInAddress}&outputMint=${tokenOutAddress}&amount=${ethers.parseUnits(amountIn, 18).toString()}&slippageBps=50&onlyDirectRoutes=false`;
    
    console.log("🔍 Jupiter API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ Jupiter API failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.outAmount) {
      const amountOut = ethers.formatUnits(data.outAmount, 18);
      console.log(`✅ Jupiter quote: ${amountOut} tokens for ${amountIn} input`);
      
      return {
        amountOut,
        gasEstimate: data.otherAmountThreshold || "150000",
        route: ["jupiter_aggregator"],
        source: "jupiter",
        liquidity: "40000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ Jupiter quote failed:", error);
    return null;
  }
}

// 🔧 NEW: Advanced Route Optimization for Competitive Quotes
async function getOptimizedRouteQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting optimized route quote for competitive pricing...");
    
    // Try to find the best route by checking multiple paths
    const routes = [
      // Direct route
      [tokenInAddress, tokenOutAddress],
      // Via WETH (common intermediate token)
      [tokenInAddress, WETH_ADDRESS, tokenOutAddress],
      // Via USDC (stablecoin route)
      [tokenInAddress, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", tokenOutAddress]
    ];
    
    let bestQuote = null;
    let bestAmountOut = 0n;
    
    for (const route of routes) {
      try {
        // Check each DEX for this route
        for (const [dexId, dexConfig] of Object.entries(DEX_CONFIGS.dexes)) {
          const routerABI = ["function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)"];
          const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
          const router = new ethers.Contract(dexConfig.router, routerABI, provider);
          
          const amountInWei = ethers.parseUnits(amountIn, 18);
          const amountsOut = await router.getAmountsOut(amountInWei, route);
          const amountOut = amountsOut[amountsOut.length - 1];
          
          if (amountOut > bestAmountOut) {
            bestAmountOut = amountOut;
            bestQuote = {
              amountOut: ethers.formatUnits(amountOut, 18),
              gasEstimate: dexConfig.gasEstimate,
              route: route.map((_, i) => `${dexId}_${i}`),
              source: `${dexId}_optimized`,
              liquidity: "5000",
              slippage: 0.005
            };
          }
        }
      } catch (error) {
        console.log(`⚠️ Route ${route.join('->')} failed:`, error);
        continue;
      }
    }
    
    if (bestQuote) {
      console.log(`✅ Optimized route quote: ${bestQuote.amountOut} tokens via ${bestQuote.source}`);
      return bestQuote;
    }
    
    return null;
  } catch (error) {
    console.log("❌ Optimized route quote failed:", error);
    return null;
  }
}

// 🔧 NEW: Split Trade Optimization for Large Amounts
async function getSplitTradeQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log("🔄 Getting split trade quote for optimal execution...");
    
    const amount = parseFloat(amountIn);
    
    // Only use split trades for larger amounts where it makes sense
    if (amount < 0.01) {
      return null;
    }
    
    // Split into 2-3 parts for better execution
    const splits = [0.6, 0.4]; // 60% + 40%
    let totalAmountOut = 0n;
    let totalGas = 0;
    
    for (const split of splits) {
      const splitAmount = amount * split;
      const splitAmountIn = splitAmount.toString();
      
      // Get quote for this split amount
      const splitQuote = await getDexQuote("uniswap_v2", tokenInAddress, tokenOutAddress, splitAmountIn);
      if (splitQuote) {
        totalAmountOut += ethers.parseUnits(splitQuote.amountOut, 18);
        totalGas += parseInt(splitQuote.gasEstimate);
      }
    }
    
    if (totalAmountOut > 0n) {
      const totalAmountOutFormatted = ethers.formatUnits(totalAmountOut, 18);
      console.log(`✅ Split trade quote: ${totalAmountOutFormatted} tokens (${splits.length} splits)`);
      
      return {
        amountOut: totalAmountOutFormatted,
        gasEstimate: totalGas.toString(),
        route: ["split_trade"],
        source: "split_trade",
        liquidity: "8000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log("❌ Split trade quote failed:", error);
    return null;
  }
}

// 🔧 NEW: Quote Competitiveness Validation
async function validateQuoteCompetitiveness(
  quote: { amountOut: string; source: string },
  inputAmount: string,
  inputToken: string,
  outputToken: string
): Promise<{ isCompetitive: boolean; marketPrice: number; quotePrice: number; improvement: number }> {
  try {
    console.log("🔍 Validating quote competitiveness...");
    
    // Get market prices for comparison
    const inputPrice = await getTokenPrice(inputToken);
    const outputPrice = await getTokenPrice(outputToken);
    
    if (!inputPrice || !outputPrice) {
      console.log("⚠️ Could not get market prices for validation");
      return { isCompetitive: true, marketPrice: 0, quotePrice: 0, improvement: 0 };
    }
    
    // Calculate expected market rate
    const inputValue = parseFloat(inputAmount) * inputPrice;
    const expectedOutput = inputValue / outputPrice;
    const actualOutput = parseFloat(quote.amountOut);
    
    // Calculate price improvement
    const improvement = ((actualOutput - expectedOutput) / expectedOutput) * 100;
    
    // Quote is competitive if it's within 5% of market price or better
    const isCompetitive = improvement >= -5;
    
    console.log("📊 Quote competitiveness analysis:", {
      source: quote.source,
      expectedOutput: expectedOutput.toFixed(6),
      actualOutput: actualOutput.toFixed(6),
      improvement: improvement.toFixed(2) + "%",
      isCompetitive
    });
    
    return {
      isCompetitive,
      marketPrice: expectedOutput,
      quotePrice: actualOutput,
      improvement
    };
  } catch (error) {
    console.log("❌ Quote validation failed:", error);
    return { isCompetitive: true, marketPrice: 0, quotePrice: 0, improvement: 0 };
  }
}

// 🔧 NEW: Enhanced Quote Selection with Competitiveness Check
async function selectBestCompetitiveQuote(quotes: Array<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number; priority: number }>, inputAmount: string, inputToken: string, outputToken: string) {
  if (quotes.length === 0) return null;
  
  console.log("🏆 Selecting best competitive quote from", quotes.length, "options...");
  
  // First, validate all quotes for competitiveness
  const validatedQuotes = await Promise.all(
    quotes.map(async (quote) => {
      const validation = await validateQuoteCompetitiveness(quote, inputAmount, inputToken, outputToken);
      return { ...quote, validation };
    })
  );
  
  // Filter out non-competitive quotes (unless no competitive ones exist)
  const competitiveQuotes = validatedQuotes.filter(q => q.validation.isCompetitive);
  const quotesToUse = competitiveQuotes.length > 0 ? competitiveQuotes : validatedQuotes;
  
  // Sort by priority first, then by output amount
  const sortedQuotes = quotesToUse.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return parseFloat(b.amountOut) - parseFloat(a.amountOut);
  });
  
  const bestQuote = sortedQuotes[0];
  
  console.log("🏆 Best competitive quote selected:", {
    source: bestQuote.source,
    amountOut: bestQuote.amountOut,
    priority: bestQuote.priority,
    competitiveness: bestQuote.validation?.improvement?.toFixed(2) + "%",
    totalQuotes: quotesToUse.length
  });
  
  return bestQuote;
}

// 🔧 ENHANCED: Individual DEX Quote with better error handling
async function getDexQuote(
  dexId: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number } | null> {
  try {
    console.log(`🔄 Getting ${dexId} quote...`);
    
    const dexConfig = DEX_CONFIGS.dexes[dexId as keyof typeof DEX_CONFIGS.dexes];
    if (!dexConfig) {
      console.log(`❌ DEX ${dexId} not configured`);
      return null;
    }
    
    // Simple ABI for getAmountsOut
    const routerABI = ["function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)"];
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const router = new ethers.Contract(dexConfig.router, routerABI, provider);
    
    const amountInWei = ethers.parseUnits(amountIn, 18).toString();
    const amountsOut = await router.getAmountsOut(amountInWei, [tokenInAddress, tokenOutAddress]);
    const amountOut = amountsOut[1];
    
    if (amountOut && amountOut > 0n) {
      const formattedAmountOut = ethers.formatUnits(amountOut, 18);
      console.log(`✅ ${dexId} quote: ${formattedAmountOut} tokens`);
      
      return {
        amountOut: formattedAmountOut,
        gasEstimate: dexConfig.gasEstimate,
        route: [dexId],
            source: dexId,
        liquidity: "1000",
        slippage: 0.005
      };
    }
    
    return null;
  } catch (error) {
    console.log(`❌ ${dexId} quote failed:`, error);
    return null;
  }
}

// 🔧 NEW: Comprehensive quote comparison and selection
// 🔧 REMOVED: selectBestQuote function is no longer used since we now use selectBestCompetitiveQuote
// This function was replaced by the more advanced competitiveness validation system

// 🔧 NEW: Calculate comprehensive quote metrics
async function calculateQuoteMetrics(quote: any, inputAmount: string, inputToken: string, outputToken: string) {
  try {
    let priceImpact = 0;
    let inputValue = 0;
    let outputValue = 0;
    
    if (quote.source === "0x" || quote.source === "okx" || quote.source === "1inch") {
      // For aggregators, use minimal price impact since they optimize for best execution
      priceImpact = quote.source === "okx" ? 0.3 : 0.5;
      inputValue = parseFloat(inputAmount);
      outputValue = parseFloat(quote.amountOut);
    } else {
      // For DEX quotes, calculate based on token prices
      const inputPrice = await getTokenPrice(inputToken);
      const outputPrice = await getTokenPrice(outputToken);
      inputValue = parseFloat(inputAmount) * inputPrice;
      outputValue = parseFloat(quote.amountOut) * outputPrice;
      priceImpact = calculatePriceImpact(inputValue, outputValue);
    }
    
    // Calculate fees (0.3% for most DEXs)
    const fees = inputValue * 0.003;
    
    // Calculate minimum received (with slippage)
    const minimumReceived = parseFloat(quote.amountOut) * (1 - quote.slippage);
    
    return {
      priceImpact: Math.abs(priceImpact),
      fees,
      executionPrice: outputValue / parseFloat(inputAmount),
      minimumReceived: minimumReceived.toString(),
      priceImpactLevel: getPriceImpactLevel(Math.abs(priceImpact))
    };
  } catch (error) {
    console.error("Error calculating quote metrics:", error);
    return {
      priceImpact: 0,
      fees: 0,
      executionPrice: 0,
      minimumReceived: quote.amountOut,
      priceImpactLevel: "low" as const
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json();
    console.log("🔄 Quote API received request:", body);
    
    const { inputToken, outputToken, inputAmount, walletAddress, tokenAddress, preferredDex } = body;
    
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
    const inputTokenInfo = getTokenInfo(inputToken, inputToken !== "ETH" ? tokenAddress : undefined);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken !== "ETH" ? tokenAddress : undefined);
    
    // 🔧 ENHANCED: For ETH swaps, we need to use WETH address for internal DEX calls
    const actualInputToken = inputToken === "ETH" ? WETH_ADDRESS : inputTokenInfo.address;
    const actualOutputToken = outputToken === "ETH" ? WETH_ADDRESS : outputTokenInfo.address;
    
    console.log("🔍 Token address mapping:", {
      inputToken: inputToken,
      inputTokenAddress: inputTokenInfo.address,
      actualInputToken: actualInputToken,
      outputToken: outputToken,
      outputTokenAddress: outputTokenInfo.address,
      actualOutputToken: actualOutputToken,
      inputAmount
    });
    
    // 🔧 ENHANCED: Comprehensive quote collection from ALL sources
    console.log("🚀 Starting comprehensive quote collection...");
    
    const allQuotes: Array<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity: string; slippage: number; priority: number }> = [];
    
    // 🔧 PRIORITY 1: Try all aggregators in parallel
    console.log("🔄 PRIORITY 1: Calling all aggregators in parallel...");
    
    const aggregatorPromises = [
      get0xQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 1 } : null),
      getOkxQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 2 } : null),
      get1inchQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 3 } : null),
      getParaSwapQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 4 } : null),
      getOpenOceanQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 5 } : null),
      getJupiterQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 6 } : null)
    ];
    
    // 🔧 NEW: Add advanced optimization quotes
    const optimizationPromises = [
      getOptimizedRouteQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 7 } : null),
      getSplitTradeQuote(actualInputToken, actualOutputToken, inputAmount).then(quote => quote ? { ...quote, priority: 8 } : null)
    ];
    
    const aggregatorResults = await Promise.allSettled(aggregatorPromises);
    const optimizationResults = await Promise.allSettled(optimizationPromises);
    
    aggregatorResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        allQuotes.push(result.value);
        console.log(`✅ Aggregator ${index + 1} quote received:`, result.value.source);
      } else if (result.status === 'rejected') {
        console.log(`❌ Aggregator ${index + 1} failed:`, result.reason);
      }
    });
    
    optimizationResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        allQuotes.push(result.value);
        console.log(`✅ Optimization ${index + 1} quote received:`, result.value.source);
      } else if (result.status === 'rejected') {
        console.log(`❌ Optimization ${index + 1} failed:`, result.reason);
      }
    });
    
    // 🔧 PRIORITY 2: Try individual DEXes in parallel
    if (allQuotes.length === 0 || preferredDex) {
      console.log("🔄 PRIORITY 2: Trying individual DEXes...");
      
      const dexPromises = Object.keys(DEX_CONFIGS.dexes).map(dexId => 
        getDexQuote(dexId, actualInputToken, actualOutputToken, inputAmount)
          .then(quote => quote ? { ...quote, priority: DEX_CONFIGS.dexes[dexId as keyof typeof DEX_CONFIGS.dexes].priority } : null)
      );
      
      const dexResults = await Promise.allSettled(dexPromises);
      
          dexResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allQuotes.push(result.value);
          console.log(`✅ DEX ${index + 1} quote received:`, result.value.source);
        } else if (result.status === 'rejected') {
          console.log(`❌ DEX ${index + 1} failed:`, result.reason);
        }
      });
    }
    
    // 🔧 ENHANCED: Select best quote from all available sources
    const bestQuote = await selectBestCompetitiveQuote(allQuotes, inputAmount, actualInputToken, actualOutputToken);
    
    if (!bestQuote) {
      return NextResponse.json(
        { error: "No quotes available from any source" },
        { status: 500 }
      );
    }
    
    console.log("🎯 Final quote selected:", {
      source: bestQuote.source,
      amountOut: bestQuote.amountOut,
      route: bestQuote.route,
      totalQuotesAvailable: allQuotes.length
    });
    
    // 🔧 ENHANCED: Calculate comprehensive metrics
    const metrics = await calculateQuoteMetrics(bestQuote, inputAmount, actualInputToken, actualOutputToken);
    
    // 🔧 ENHANCED: Prepare enhanced response with quote comparison
    const response: QuoteResponse = {
      inputAmount,
      outputAmount: bestQuote.amountOut,
      priceImpact: metrics.priceImpact,
      gasEstimate: bestQuote.gasEstimate,
      route: bestQuote.route,
      fees: metrics.fees,
      executionPrice: metrics.executionPrice,
      minimumReceived: metrics.minimumReceived,
      priceImpactLevel: metrics.priceImpactLevel,
      dexUsed: bestQuote.source,
      liquidity: bestQuote.liquidity,
      slippage: bestQuote.slippage,
      // 🔧 NEW: Include all quotes for comparison
      allQuotes: allQuotes.map(quote => ({
        source: quote.source,
        name: DEX_CONFIGS.aggregators[quote.source as keyof typeof DEX_CONFIGS.aggregators]?.name || 
               DEX_CONFIGS.dexes[quote.source as keyof typeof DEX_CONFIGS.dexes]?.name || quote.source,
        amountOut: quote.amountOut,
      gasEstimate: quote.gasEstimate,
        priceImpact: 0, // Will be calculated if needed
      liquidity: quote.liquidity,
        slippage: quote.slippage,
        priority: quote.priority
      })),
      bestQuote: {
        source: bestQuote.source,
        name: DEX_CONFIGS.aggregators[bestQuote.source as keyof typeof DEX_CONFIGS.aggregators]?.name || 
               DEX_CONFIGS.dexes[bestQuote.source as keyof typeof DEX_CONFIGS.dexes]?.name || bestQuote.source,
        reason: `Selected from ${allQuotes.length} available quotes based on priority and output amount`
      }
    };
    
    console.log("✅ Enhanced quote response:", {
      bestSource: response.dexUsed,
      bestAmount: response.outputAmount,
      totalQuotes: response.allQuotes?.length || 0,
      priceImpact: response.priceImpact
    });
    
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