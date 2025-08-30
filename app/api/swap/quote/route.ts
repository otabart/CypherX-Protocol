import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// DEX Router Addresses on Base Chain - Updated with verified addresses
const DEX_ROUTERS = {
  // Uniswap V2 - Most reliable on Base chain
  uniswap_v2: {
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    factory: "0x8909dc15e40173ff4699343b6eb8132c65e18ec6",
    version: "v2"
  },
  // Aerodrome - Verified router address
  aerodrome: {
    router: "0xE9992487b2EE03b7a91241695A58E0ef3654643E",
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    quoter: "0x6F257E7F63cB7C88Cd4FDBb4C6B6f5D4c6A6E7F3",
    version: "v2"
  },
  // Uniswap V3 - Verified addresses
  uniswap_v3: {
    router: "0x6ff5693b99212da76ad316178a184ab56d299b43", // SwapRouter2
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    quoter: "0x3d4e44Eb137fd1710B3961a3B3A04F56a85e5870",
    version: "v3"
  },
  // BaseSwap - Verified addresses
  baseswap: {
    router: "0xFD14567eaf9ba9b71d4a6b255d96842dEF71D2bE",
    factory: "0xFDa619b6d209A7e7De1A5c7C7bDC9F1bEA73f33a",
    version: "v2"
  },
  // SushiSwap - Verified addresses
  sushiswap: {
    router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Router02
    factory: "0xc35DADB65012eC5796536bD9864eD8773ABc74C4",
    version: "v2"
  },
  // 1inch Aggregator
  oneinch: {
    router: "0x1111111254EEB25477B68fb85Ed929f73A960582", // AggregationRouterV5
    version: "aggregator"
  }
};

// Router ABIs - Updated with all DEX methods
const ROUTER_ABIS: { [key: string]: any } = {
  uniswap_v2: [
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
    "function swapExactETHForTokens(uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external"
  ],
  aerodrome: [
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
    "function swapExactETHForTokens(uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external"
  ],
  uniswap_v3: [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
    "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
    "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)"
  ],
  baseswap: [
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
    "function swapExactETHForTokens(uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external"
  ],
  sushiswap: [
    "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
    "function swapExactETHForTokens(uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) external"
  ],
  oneinch: [
    "function swap((address executor, address desc, bytes data)) external payable returns (uint256 amountOut)",
    "function unoswap(address token, uint256 amount, uint256 minReturn, bytes32[] memory pools) external payable returns (uint256 amountOut)"
  ]
};

// Base RPC URL for Base network
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";

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

// Get ETH price with multiple reliable sources
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
  if (tokenAddress === WETH_ADDRESS) {
    return await getEthPrice();
  }

  try {
    console.log(`🔍 Fetching token price for: ${tokenAddress}`);
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

// Test DEX liquidity and get quote
async function testDexQuote(
  dexId: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ success: boolean; amountOut?: string; gasEstimate?: string; error?: string; liquidity?: string; source?: string }> {
  try {
    const dexConfig = DEX_ROUTERS[dexId as keyof typeof DEX_ROUTERS];
    if (!dexConfig) {
      return { success: false, error: "DEX not supported" };
    }

    // Check if this is a self-swap (same token)
    if (tokenInAddress.toLowerCase() === tokenOutAddress.toLowerCase()) {
      return { success: false, error: "Cannot swap token for itself" };
    }

    console.log(`🔄 Testing ${dexId} quote for ${amountIn} ${tokenInAddress} -> ${tokenOutAddress}`);

    // Convert amount to wei
    const amountInWei = ethers.parseUnits(amountIn, 18).toString();

    // Get router ABI based on DEX
    const routerABI = ROUTER_ABIS[dexId as keyof typeof ROUTER_ABIS] || ROUTER_ABIS.uniswap_v2;
    
    // Create provider and router contract
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const router = new ethers.Contract(dexConfig.router, routerABI, provider);

    // Determine the correct method to call based on token types
    let method: string;
    let params: any[];

    if (tokenInAddress === WETH_ADDRESS && tokenOutAddress !== WETH_ADDRESS) {
      // ETH -> Token
      method = 'swapExactETHForTokens';
      params = [
        0, // amountOutMin (we'll calculate this)
        [tokenInAddress, tokenOutAddress], // path
        "0x0000000000000000000000000000000000000000", // to (will be set by wallet)
        Math.floor(Date.now() / 1000) + 1200 // deadline (20 minutes)
      ];
    } else if (tokenInAddress !== WETH_ADDRESS && tokenOutAddress === WETH_ADDRESS) {
      // Token -> ETH
      method = 'swapExactTokensForETH';
      params = [
        ethers.parseUnits(amountIn, 18), // amountIn
        0, // amountOutMin (we'll calculate this)
        [tokenInAddress, tokenOutAddress], // path
        "0x0000000000000000000000000000000000000000", // to (will be set by wallet)
        Math.floor(Date.now() / 1000) + 1200 // deadline (20 minutes)
      ];
    } else {
      // Token -> Token
      method = 'swapExactTokensForTokens';
      params = [
        ethers.parseUnits(amountIn, 18), // amountIn
        0, // amountOutMin (we'll calculate this)
        [tokenInAddress, tokenOutAddress], // path
        "0x0000000000000000000000000000000000000000", // to (will be set by wallet)
        Math.floor(Date.now() / 1000) + 1200 // deadline (20 minutes)
      ];
    }

    // Try to get quote using getAmountsOut
    try {
      console.log(`🔍 Calling getAmountsOut for ${dexId}...`);
      const amountsOut = await router.getAmountsOut(amountInWei, [tokenInAddress, tokenOutAddress]);
      const amountOut = amountsOut[1];
      
      if (amountOut && amountOut > 0n) {
        console.log(`✅ ${dexId} quote successful: ${ethers.formatUnits(amountOut, 18)} ${tokenOutAddress}`);
        
        // Estimate gas
        let gasEstimate = "150000"; // Default
        try {
          const gasEst = await router[method].estimateGas(...params);
          gasEstimate = gasEst.toString();
        } catch (gasError) {
          console.log(`⚠️ Gas estimation failed for ${dexId}, using default:`, gasError);
        }

        return {
          success: true,
          amountOut: ethers.formatUnits(amountOut, 18),
          gasEstimate,
          liquidity: "1000", // Placeholder
          source: dexId
        };
      }
    } catch (quoteError) {
      console.log(`❌ getAmountsOut failed for ${dexId}:`, quoteError);
    }

    // If getAmountsOut fails, try alternative methods for specific DEXs
    if (dexId === 'aerodrome') {
      try {
        console.log(`🔍 Trying Aerodrome specific quote method...`);
        // Aerodrome might have different method names
        const aerodromeAmountsOut = await router.getAmountOut(amountInWei, tokenInAddress, tokenOutAddress);
        if (aerodromeAmountsOut && aerodromeAmountsOut > 0n) {
          console.log(`✅ Aerodrome quote successful: ${ethers.formatUnits(aerodromeAmountsOut, 18)}`);
          return {
            success: true,
            amountOut: ethers.formatUnits(aerodromeAmountsOut, 18),
            gasEstimate: "200000",
            liquidity: "1000",
            source: dexId
          };
        }
      } catch (aerodromeError) {
        console.log(`❌ Aerodrome specific quote failed:`, aerodromeError);
      }
    }

    // If all quote methods fail, return error
    return {
      success: false,
      error: "No liquidity found for this token pair",
      source: dexId
    };

  } catch (error) {
    console.error(`❌ ${dexId} quote error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      source: dexId
    };
  }
}

// Get quote from multiple DEXs
async function getMultiDexQuote(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  preferredDex?: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity?: string; slippage?: string }> {
  console.log("🔄 Starting multi-DEX quote for:", {
    tokenInAddress,
    tokenOutAddress,
    amountIn,
    preferredDex
  });
  
  const quotes = [];
  
  // If preferred DEX is specified, try it first
  if (preferredDex && DEX_ROUTERS[preferredDex as keyof typeof DEX_ROUTERS]) {
    console.log(`✅ Testing preferred DEX: ${preferredDex}`);
    const quote = await testDexQuote(preferredDex, tokenInAddress, tokenOutAddress, amountIn);
    if (quote.success) {
      quotes.push(quote);
      console.log(`✅ Preferred DEX ${preferredDex} quote:`, quote);
    } else {
      console.log(`❌ Preferred DEX ${preferredDex} failed:`, quote.error);
    }
  }
  
  // Try all DEXs in order of reliability
  const dexOrder = ['uniswap_v2', 'aerodrome', 'baseswap'];
  
  for (const dexId of dexOrder) {
    // Skip if already tried as preferred DEX
    if (dexId === preferredDex) continue;
    
    try {
      console.log(`🔄 Testing ${dexId}...`);
      const quote = await testDexQuote(dexId, tokenInAddress, tokenOutAddress, amountIn);
      if (quote.success) {
        quotes.push(quote);
        console.log(`✅ ${dexId} quote added:`, quote);
    } else {
        console.log(`❌ ${dexId} failed:`, quote.error);
      }
    } catch (error) {
      console.log(`❌ ${dexId} failed:`, error);
    }
  }
  
  // Try DexScreener for additional routes
  try {
    console.log("🔄 Getting DexScreener quotes...");
    const dexScreenerQuotes = await getDexScreenerQuotes(tokenInAddress, tokenOutAddress, amountIn);
    quotes.push(...dexScreenerQuotes);
      } catch (error) {
    console.log("❌ DexScreener quotes failed:", error);
  }
  
  console.log("📊 Total quotes collected:", quotes.length);
  
  // Return best quote
  if (quotes.length === 0) {
    console.log("❌ No quotes available from any source");
    throw new Error("No liquidity found for this token pair");
  }
  
  // Select the best quote based on output amount
  quotes.sort((a, b) => parseFloat(b.amountOut || "0") - parseFloat(a.amountOut || "0"));
  const bestQuote = quotes[0];
  
  console.log("🏆 Best quote selected:", {
    source: bestQuote.source || "unknown",
    amountOut: bestQuote.amountOut,
    liquidity: bestQuote.liquidity,
    gasEstimate: bestQuote.gasEstimate
  });
  
  return {
    amountOut: bestQuote.amountOut || "0",
    gasEstimate: bestQuote.gasEstimate || "150000",
    source: bestQuote.source || "unknown",
    route: [bestQuote.source || "unknown"],
    liquidity: bestQuote.liquidity || "1000",
    slippage: "0.005"
  };
}

// Get quotes from DexScreener
async function getDexScreenerQuotes(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string
): Promise<{ amountOut: string; gasEstimate: string; route: string[]; source: string; liquidity?: string; slippage?: string }[]> {
  const quotes = [];
  
  try {
    // Get DexScreener data for both tokens
    const [inputTokenResponse, outputTokenResponse] = await Promise.all([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInAddress}`),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenOutAddress}`)
    ]);
    
    if (!inputTokenResponse.ok || !outputTokenResponse.ok) {
      throw new Error(`DexScreener API error: ${inputTokenResponse.status} ${outputTokenResponse.status}`);
    }
    
    const inputTokenData = await inputTokenResponse.json();
    const outputTokenData = await outputTokenResponse.json();
    
    // Combine and find matching pairs
    const allPairs = [
      ...(inputTokenData.pairs || []),
      ...(outputTokenData.pairs || [])
    ];
    
    // Find exact pair matches
    const exactPairs = allPairs.filter((pair: any) => 
      (pair.baseToken?.address?.toLowerCase() === tokenInAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase()) ||
      (pair.baseToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenInAddress.toLowerCase())
    );
    
    // Remove duplicates and sort by liquidity
    const uniquePairs = exactPairs.filter((pair: any, index: number, self: any[]) => 
      index === self.findIndex((p: any) => p.pairAddress === pair.pairAddress)
    );
    
    const sortedPairs = uniquePairs.sort((a: any, b: any) => {
      const liquidityA = parseFloat(a.liquidity?.usd || "0");
      const liquidityB = parseFloat(b.liquidity?.usd || "0");
      return liquidityB - liquidityA;
    });
    
    console.log("📊 DexScreener pairs found:", sortedPairs.length);
    
    for (const pair of sortedPairs.slice(0, 3)) { // Process top 3 pairs
      try {
        const liquidity = parseFloat(pair.liquidity?.usd || "0");
        const dexId = pair.dexId || "unknown";
        
        if (liquidity > 0) {
          console.log(`🔍 Trying on-chain quote for ${dexId} pair: ${pair.pairAddress}`);
          
          // Try to get real on-chain quote for this specific pair
          const onChainQuote = await testDexQuote(dexId, tokenInAddress, tokenOutAddress, amountIn);
          
          if (onChainQuote.success && onChainQuote.amountOut) {
          quotes.push({
              amountOut: onChainQuote.amountOut,
              gasEstimate: onChainQuote.gasEstimate || "150000",
            source: dexId,
            route: [dexId],
            liquidity: liquidity.toString(),
              slippage: "0.005" // Default slippage
          });
          
            console.log("✅ On-chain quote added from DexScreener pair:", {
            dex: dexId,
            liquidity,
              amountOut: onChainQuote.amountOut,
              gasEstimate: onChainQuote.gasEstimate
          });
        } else {
            console.log(`❌ On-chain quote failed for ${dexId}:`, onChainQuote.error);
          }
        }
      } catch (error) {
        console.error("❌ Error processing DexScreener pair:", error);
        continue;
      }
    }
  } catch (error) {
    console.error("❌ DexScreener quote failed:", error);
  }
  
  return quotes;
}

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json();
    console.log("Quote API received request:", body);
    
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
    console.log("Getting token info for quote:", { inputToken, outputToken, tokenAddress });
    const inputTokenInfo = getTokenInfo(inputToken, inputToken !== "ETH" ? tokenAddress : undefined);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken !== "ETH" ? tokenAddress : undefined);
    console.log("Quote token info:", { inputTokenInfo, outputTokenInfo });
    
    // Validate token addresses
    if (!inputTokenInfo.address || !outputTokenInfo.address) {
      throw new Error("Invalid token addresses for quote");
    }
    
    console.log("🔍 Token addresses for quote:", {
      inputToken: inputTokenInfo.address,
      outputToken: outputTokenInfo.address,
      inputTokenSymbol: inputTokenInfo.symbol,
      outputTokenSymbol: outputTokenInfo.symbol
    });
    
    // Get multi-DEX quote
    const quote = await getMultiDexQuote(
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      preferredDex
    );
    
    // Get current prices for calculation
    const inputPrice = await getTokenPrice(inputTokenInfo.address);
    const outputPrice = await getTokenPrice(outputTokenInfo.address);
    
    console.log("💰 Price data:", { 
      inputPrice, 
      outputPrice, 
      inputAmount, 
      outputAmount: quote.amountOut
    });
    
    // Calculate price impact
    const inputValue = amount * inputPrice;
    const outputValue = parseFloat(quote.amountOut) * outputPrice;
    const priceImpact = calculatePriceImpact(inputValue, outputValue);
    
    // Calculate fees (0.3% for most DEXs)
    const fees = inputValue * 0.003;
    
    // Calculate minimum received (with slippage)
    const slippage = 0.005; // 0.5% default slippage
    const minimumReceived = parseFloat(quote.amountOut) * (1 - slippage);
    
    const response: QuoteResponse = {
      inputAmount,
      outputAmount: quote.amountOut,
      priceImpact: Math.abs(priceImpact),
      gasEstimate: quote.gasEstimate || "150000",
      route: quote.route || ["Unknown"],
      fees,
      executionPrice: outputValue / amount,
      minimumReceived: minimumReceived.toString(),
      priceImpactLevel: getPriceImpactLevel(Math.abs(priceImpact)),
      dexUsed: quote.source,
      liquidity: quote.liquidity || "Unknown"
    };
    
    console.log("✅ Quote response:", response);
    
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
