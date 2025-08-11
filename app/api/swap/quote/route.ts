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
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    return data.ethereum?.usd || 0;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    return 0;
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
    
    console.log(`No price found for token ${tokenAddress}`);
    return 0;
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0;
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
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER, QUOTER_ABI, provider);
    
    const amountInWei = ethers.parseUnits(amountIn, decimals);
    const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    
    let bestQuote = null;
    let bestAmountOut = 0n;
    let bestGasEstimate = 0n;
    
    for (const fee of feeTiers) {
      try {
        const quote = await quoter.quoteExactInputSingle(
          tokenInAddress,
          tokenOutAddress,
          amountInWei,
          fee,
          0 // sqrtPriceLimitX96
        );
        
        const amountOutWei = quote[0];
        if (amountOutWei > bestAmountOut) {
          bestAmountOut = amountOutWei;
          bestGasEstimate = quote[3];
          bestQuote = quote;
        }
             } catch (error) {
         console.log(`Fee tier ${fee} failed:`, error instanceof Error ? error.message : 'Unknown error');
         // Continue to next fee tier
         continue;
       }
    }
    
    if (!bestQuote) {
      throw new Error("No valid quote found from Uniswap V3");
    }
    
    return {
      amountOut: ethers.formatUnits(bestAmountOut, decimals),
      gasEstimate: ethers.formatEther(bestGasEstimate)
    };
  } catch (error) {
    console.error("Uniswap quote error:", error);
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
  const quotes = [];
  
  // Try Uniswap V3
  try {
    const uniswapQuote = await getUniswapQuote(tokenInAddress, tokenOutAddress, amountIn, decimals);
    quotes.push({
      ...uniswapQuote,
      source: "Uniswap V3",
      route: ["Uniswap V3"]
    });
    console.log("Uniswap quote:", uniswapQuote);
  } catch (error) {
    console.error("Uniswap quote failed:", error);
  }
  
  // Try DexScreener for additional routes
  try {
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
    
    console.log("DexScreener pairs found:", pairs.length);
    
    for (const pair of pairs.slice(0, 3)) { // Limit to top 3 routes
      try {
        // Calculate quote based on pair price and liquidity
        const pairPrice = parseFloat((pair as { priceUsd?: string }).priceUsd || "0");
        const inputPrice = parseFloat((pair as { baseToken?: { priceUsd?: string } }).baseToken?.priceUsd || "0");
        const liquidity = parseFloat((pair as { liquidity?: { usd?: string } }).liquidity?.usd || "0");
        
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
          
          console.log("DexScreener quote:", {
            pair: (pair as { dexId?: string }).dexId,
            price: pairPrice,
            inputPrice,
            liquidity,
            estimatedOutput,
            finalOutput,
            slippage
          });
        }
      } catch {
        console.error("Error processing pair");
        continue;
      }
    }
  } catch (error) {
    console.error("DexScreener quote failed:", error);
  }
  
  // Return best quote
  if (quotes.length === 0) {
    console.log("No quotes available from any source");
    return {
      amountOut: "0",
      gasEstimate: "150000",
      route: ["No route found"]
    };
  }
  
  const bestQuote = quotes.reduce((best, current) => 
    parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
  );
  
  console.log("Best quote selected:", bestQuote);
  
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
  const inputTokenInfo = getTokenInfo(inputToken, inputToken === "ETH" ? undefined : tokenAddress);
  const outputTokenInfo = getTokenInfo(outputToken, outputToken === "ETH" ? undefined : tokenAddress);
  console.log("Quote token info:", { inputTokenInfo, outputTokenInfo });
  
  // Validate token addresses
  if (!inputTokenInfo.address || !outputTokenInfo.address) {
    throw new Error("Invalid token addresses for quote");
  }
    
    // Get aggregated quote
    const quote = await getAggregatedQuote(
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      inputTokenInfo.decimals
    );
    
    // Get current prices for better calculation
    const inputPrice = await getTokenPrice(inputTokenInfo.address);
    const outputPrice = await getTokenPrice(outputTokenInfo.address);
    
    console.log("Prices:", { inputPrice, outputPrice, inputAmount, outputAmount: quote.amountOut });
    
    // Calculate price impact
    const inputValue = amount * inputPrice;
    const outputValue = parseFloat(quote.amountOut) * outputPrice;
    const priceImpact = calculatePriceImpact(inputValue, outputValue);
    
    // Calculate fees (0.3% for Uniswap V3)
    const fees = inputValue * 0.003;
    
    // Calculate minimum received (with slippage)
    const slippage = 0.005; // 0.5% default slippage
    const minimumReceived = parseFloat(quote.amountOut) * (1 - slippage);
    
    // If we couldn't get a proper quote, provide a fallback estimate
    if (parseFloat(quote.amountOut) <= 0) {
      console.log("No valid quote found, providing fallback estimate");
      const fallbackOutput = amount * (inputPrice / outputPrice) * 0.997; // Apply 0.3% fee
      quote.amountOut = fallbackOutput.toString();
    }
    
    // Validate quote makes sense
    if (inputPrice > 0 && outputPrice > 0) {
      const expectedOutput = (amount * inputPrice) / outputPrice * 0.997; // Apply 0.3% fee
      const actualOutput = parseFloat(quote.amountOut);
      
      // If quote is significantly off (more than 50% difference), use fallback
      if (Math.abs(actualOutput - expectedOutput) / expectedOutput > 0.5) {
        console.log("Quote seems off, using fallback calculation");
        console.log("Expected:", expectedOutput, "Actual:", actualOutput);
        quote.amountOut = expectedOutput.toString();
      }
    }
    
    // Always provide a fallback if no quote was found
    if (parseFloat(quote.amountOut) <= 0 && inputPrice > 0 && outputPrice > 0) {
      console.log("Using price-based fallback calculation");
      const fallbackOutput = amount * (inputPrice / outputPrice) * 0.997;
      quote.amountOut = fallbackOutput.toString();
      quote.route = ["Price-based estimate"];
      quote.gasEstimate = "150000";
    }
    
    const response: QuoteResponse = {
      inputAmount,
      outputAmount: quote.amountOut,
      priceImpact: Math.abs(priceImpact),
      gasEstimate: quote.gasEstimate,
      route: quote.route,
      fees,
      executionPrice: outputValue / amount,
      minimumReceived: minimumReceived.toString(),
      priceImpactLevel: getPriceImpactLevel(Math.abs(priceImpact))
    };
    
    console.log("Quote response:", response);
    
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
