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

// Get ETH price
async function getEthPrice(): Promise<number> {
  try {
    console.log("🔄 Fetching ETH price from CoinGecko...");
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CypherX/1.0'
      }
    });
    const data = await response.json();
    const ethPrice = data.ethereum?.usd || 0;
    console.log("✅ ETH price from CoinGecko:", ethPrice);
    
    // If CoinGecko returns 0, use fallback
    if (ethPrice <= 0) {
      console.log("⚠️ CoinGecko returned 0, using fallback ETH price: 3000");
      return 3000;
    }
    
    return ethPrice;
  } catch (error) {
    console.error("❌ Error fetching ETH price from CoinGecko:", error);
    // Fallback to our proxy
    try {
      console.log("🔄 Trying ETH price proxy fallback...");
      const proxyResponse = await fetch("/api/coingecko-proxy?endpoint=simple/price?ids=ethereum&vs_currencies=usd");
      const proxyData = await proxyResponse.json();
      const ethPrice = proxyData.ethereum?.usd || 0;
      console.log("✅ ETH price from proxy:", ethPrice);
      
      // If proxy also returns 0, use fallback
      if (ethPrice <= 0) {
        console.log("⚠️ Proxy also returned 0, using fallback ETH price: 3000");
        return 3000;
      }
      
      return ethPrice;
    } catch (proxyError) {
      console.error("❌ Proxy fallback also failed:", proxyError);
      console.log("⚠️ Using fallback ETH price: 3000");
      return 3000; // Fallback price
    }
  }
}

// Get token price from DexScreener
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === ETH_ADDRESS || tokenAddress === WETH_ADDRESS) {
    return await getEthPrice();
  }

  try {
    // First try to get price from DexScreener
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    // Look for the best pair with highest liquidity
    const pairs = data.pairs || [];
    const bestPair = pairs.reduce((best: { liquidity?: { usd?: string }; priceUsd?: string }, current: { liquidity?: { usd?: string }; priceUsd?: string }) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || "0");
      const currentLiquidity = parseFloat(current.liquidity?.usd || "0");
      return currentLiquidity > bestLiquidity ? current : best;
    }, pairs[0]);
    
    if (bestPair?.priceUsd) {
      console.log(`Token ${tokenAddress} price: ${bestPair.priceUsd} USD`);
      return parseFloat(bestPair.priceUsd);
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
): Promise<{ amountOut: string; gasEstimate: string; route: string[] }> {
  console.log("🔄 Starting aggregated quote for:", {
    tokenInAddress,
    tokenOutAddress,
    amountIn,
    decimals
  });
  
  const quotes = [];
  
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
  }
  
  // Try DexScreener for additional routes
  try {
    console.log("🔄 Attempting DexScreener quote...");
    // Search for the specific token pair
    const searchQuery = `${tokenInAddress} ${tokenOutAddress}`;
    const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${searchQuery}`);
    const dexData = await dexScreenerResponse.json();
    
    // Process DexScreener routes - look for exact pair matches
    const pairs = dexData.pairs?.filter((pair: { baseToken?: { address?: string }; quoteToken?: { address?: string } }) => 
      (pair.baseToken?.address?.toLowerCase() === tokenInAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase()) ||
      (pair.baseToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase() && 
       pair.quoteToken?.address?.toLowerCase() === tokenInAddress.toLowerCase())
    ) || [];
    
    console.log("📊 DexScreener pairs found:", pairs.length);
    
    for (const pair of pairs.slice(0, 3)) { // Limit to top 3 routes
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
        
        // For ETH swaps, we need to get the ETH price from the base token if it's ETH/WETH
        let inputPrice = parseFloat((pair as { baseToken?: { priceUsd?: string } }).baseToken?.priceUsd || "0");
        
        // If inputPrice is 0 and we're dealing with ETH, try to get ETH price from quote token
        if (inputPrice === 0 && (tokenInAddress === WETH_ADDRESS || tokenOutAddress === WETH_ADDRESS)) {
          inputPrice = parseFloat((pair as { quoteToken?: { priceUsd?: string } }).quoteToken?.priceUsd || "0");
        }
        
        // If still 0, use fallback ETH price
        if (inputPrice === 0 && (tokenInAddress === WETH_ADDRESS || tokenOutAddress === WETH_ADDRESS)) {
          inputPrice = 3000; // Fallback ETH price
          console.log("⚠️ Using fallback ETH price for DexScreener calculation");
        }
        
        console.log("💰 DexScreener pair data:", { pairPrice, inputPrice, liquidity });
        
        if (pairPrice > 0 && inputPrice > 0 && liquidity > 0) {
          // Calculate based on actual pair data
          const amountInValue = parseFloat(amountIn) * inputPrice;
          const estimatedOutput = amountInValue / pairPrice;
          
          // Apply slippage based on liquidity
          const slippage = Math.min(0.1, 1000 / liquidity); // Higher liquidity = lower slippage
          const finalOutput = estimatedOutput * (1 - slippage);
          
          quotes.push({
            amountOut: finalOutput.toString(),
            gasEstimate: "150000", // Default gas estimate
            source: (pair as { dexId?: string }).dexId || "Unknown DEX",
            route: [(pair as { dexId?: string }).dexId || "Unknown DEX"]
          });
          
          console.log("✅ DexScreener quote added:", {
            pair: (pair as { dexId?: string }).dexId,
            price: pairPrice,
            inputPrice,
            liquidity,
            estimatedOutput,
            finalOutput,
            slippage
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
  
  // Prioritize Uniswap V3 quotes over DexScreener
  const uniswapQuotes = quotes.filter(q => q.source === "Uniswap V3");
  const dexScreenerQuotes = quotes.filter(q => q.source !== "Uniswap V3");
  
  let bestQuote;
  if (uniswapQuotes.length > 0) {
    // Use best Uniswap V3 quote if available
    bestQuote = uniswapQuotes.reduce((best, current) => 
      parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
    );
    console.log("🏆 Using Uniswap V3 quote:", bestQuote);
  } else {
    // Fallback to DexScreener only if no Uniswap V3 liquidity
    bestQuote = dexScreenerQuotes.reduce((best, current) => 
      parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
    );
    console.log("⚠️ No Uniswap V3 liquidity, using DexScreener quote:", bestQuote);
  }
  
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
  
  return {
    amountOut: bestQuote.amountOut,
    gasEstimate: bestQuote.gasEstimate,
    route: bestQuote.route
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
    const quote = await getAggregatedQuote(
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      inputTokenInfo.decimals
    );
    
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
