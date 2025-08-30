import { NextResponse } from "next/server";
import { CypherXSwapV3 } from "../../../../../lib/uniswap-v3-style-swap";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenIn, tokenOut, amountIn, slippageTolerance = 0.5 } = body;

    // Validate inputs
    if (!tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json({
        success: false,
        error: "MISSING_PARAMETERS",
        message: "Missing required parameters: tokenIn, tokenOut, amountIn"
      }, { status: 400 });
    }

    // Validate amount
    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: "INVALID_AMOUNT",
        message: "Amount must be a positive number"
      }, { status: 400 });
    }

    // Validate slippage
    if (slippageTolerance < 0 || slippageTolerance > 50) {
      return NextResponse.json({
        success: false,
        error: "INVALID_SLIPPAGE",
        message: "Slippage tolerance must be between 0 and 50"
      }, { status: 400 });
    }

    console.log("🔍 V3 Quote Request:", {
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance
    });

    // Initialize V3 swap system
    const swapV3 = new CypherXSwapV3();
    
    // Get quote using V3 routing
    const quote = await swapV3.getQuote(tokenIn, tokenOut, amountIn, slippageTolerance);
    
    if (!quote) {
      return NextResponse.json({
        success: false,
        error: "NO_ROUTE_FOUND",
        message: "No valid swap route found for this token pair"
      }, { status: 404 });
    }

    // Calculate additional metrics
    const priceImpact = quote.priceImpact;
    const gasEstimate = quote.gasEstimate;
    const dexId = quote.dexId;
    
    // Get current prices for comparison
    const tokenInPrice = await getTokenPrice(tokenIn);
    const tokenOutPrice = await getTokenPrice(tokenOut);
    
    // Calculate USD values
    const amountInUSD = amount * tokenInPrice;
    const amountOutUSD = parseFloat(quote.amountOut) * tokenOutPrice;
    
    // Calculate effective rate
    const effectiveRate = parseFloat(quote.amountOut) / amount;
    
    // Determine route quality
    const routeQuality = determineRouteQuality(priceImpact, gasEstimate, dexId);

    const response = {
      success: true,
      data: {
        // Route information
        route: quote.route,
        dexId: quote.dexId,
        fee: quote.route.fee,
        version: quote.route.pools[0]?.version || "v2",
        
        // Amounts
        amountIn: amountIn,
        amountOut: quote.amountOut,
        amountInUSD: amountInUSD,
        amountOutUSD: amountOutUSD,
        
        // Pricing
        effectiveRate: effectiveRate,
        priceImpact: priceImpact,
        tokenInPrice: tokenInPrice,
        tokenOutPrice: tokenOutPrice,
        
        // Gas and costs
        gasEstimate: gasEstimate,
        estimatedGasCost: calculateGasCost(gasEstimate),
        
        // Quality metrics
        routeQuality: routeQuality,
        confidence: determineConfidence(priceImpact, gasEstimate),
        
        // Slippage
        slippageTolerance: slippageTolerance,
        amountOutMin: calculateAmountOutMin(quote.amountOut, slippageTolerance),
        
        // Additional info
        pools: quote.route.pools.map((pool: any) => ({
          address: pool.address,
          dexId: pool.dexId,
          fee: pool.fee,
          liquidity: pool.liquidity.toString(),
          version: pool.version
        })),
        
        // Timestamp
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 1000) // 30 seconds
      }
    };

    console.log("✅ V3 Quote Response:", {
      amountIn: response.data.amountIn,
      amountOut: response.data.amountOut,
      dexId: response.data.dexId,
      priceImpact: response.data.priceImpact,
      gasEstimate: response.data.gasEstimate
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ V3 Quote Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "QUOTE_ERROR",
      message: error instanceof Error ? error.message : "Failed to get quote",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// Helper functions
async function getTokenPrice(tokenAddress: string): Promise<number> {
  try {
    // Use the enhanced price utilities
    const { getTokenPrice } = await import("../../../../../lib/price-utils");
    return await getTokenPrice(tokenAddress);
  } catch (error) {
    console.error(`Error getting price for ${tokenAddress}:`, error);
    return 0;
  }
}

function determineRouteQuality(priceImpact: number, gasEstimate: string, dexId: string): "excellent" | "good" | "fair" | "poor" {
  const impact = priceImpact;
  const gas = parseFloat(gasEstimate);
  
  // Excellent: Low impact, low gas, preferred DEX
  if (impact < 0.1 && gas < 150000 && (dexId === "uniswap_v3" || dexId === "aerodrome")) {
    return "excellent";
  }
  
  // Good: Low impact or low gas
  if (impact < 0.5 || gas < 200000) {
    return "good";
  }
  
  // Fair: Moderate impact and gas
  if (impact < 2.0 && gas < 300000) {
    return "fair";
  }
  
  // Poor: High impact or high gas
  return "poor";
}

function determineConfidence(priceImpact: number, gasEstimate: string): "high" | "medium" | "low" {
  const impact = priceImpact;
  const gas = parseFloat(gasEstimate);
  
  if (impact < 0.5 && gas < 200000) {
    return "high";
  } else if (impact < 2.0 && gas < 300000) {
    return "medium";
  } else {
    return "low";
  }
}

function calculateGasCost(gasEstimate: string): string {
  const gas = parseFloat(gasEstimate);
  const gasPrice = 20; // Assume 20 gwei
  const gasCost = (gas * gasPrice * 1e-9); // Convert to ETH
  return gasCost.toFixed(6);
}

function calculateAmountOutMin(amountOut: string, slippageTolerance: number): string {
  const amount = parseFloat(amountOut);
  const slippageMultiplier = (100 - slippageTolerance) / 100;
  return (amount * slippageMultiplier).toFixed(18);
}
