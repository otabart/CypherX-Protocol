import { ethers } from "ethers";

// Professional DEX Aggregator - Direct Integration
// Similar to how Definitive Edge, Axiom, and Padre handle swaps

const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";


// Direct DEX Integration (Professional Approach)
const DEX_CONFIGS = {
  uniswap_v3: {
    factory: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
    quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    feeTiers: [100, 500, 3000, 10000],
    version: "v3"
  },
  aerodrome: {
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    router: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    version: "v2"
  },
  baseswap: {
    factory: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    router: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    version: "v2"
  }
};

// Professional Quote Interface
interface ProfessionalQuote {
  dexId: string;
  amountOut: string;
  gasEstimate: string;
  priceImpact: number;
  route: string[];
  poolAddress: string;
  fee: number;
  liquidity: string;
  confidence: "high" | "medium" | "low";
}

// Direct Pool Discovery (Professional Method)
export async function discoverPoolsDirectly(
  tokenIn: string,
  tokenOut: string
): Promise<Array<{
  dexId: string;
  poolAddress: string;
  fee: number;
  liquidity: bigint;
  version: string;
}>> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const pools = [];

  // 1. Direct Uniswap V3 Pool Discovery
  for (const [dexId, config] of Object.entries(DEX_CONFIGS)) {
    if (config.version === "v3" && 'feeTiers' in config) {
      for (const fee of config.feeTiers) {
        try {
          const factory = new ethers.Contract(config.factory, [
            "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
          ], provider);
          
          const poolAddress = await factory.getPool(tokenIn, tokenOut, fee);
          
          if (poolAddress !== "0x0000000000000000000000000000000000000000") {
            // Check if pool has liquidity
            const pool = new ethers.Contract(poolAddress, [
              "function liquidity() external view returns (uint128)"
            ], provider);
            
            const liquidity = await pool.liquidity();
            
            if (liquidity > 0n) {
              pools.push({
                dexId,
                poolAddress,
                fee,
                liquidity,
                version: config.version
              });
            }
          }
        } catch (error) {
          console.log(`⚠️ Error checking ${dexId} fee ${fee}:`, error);
        }
      }
    }
  }

  return pools.sort((a, b) => Number(b.liquidity - a.liquidity));
}

// Professional Quote Aggregation
export async function getProfessionalQuotes(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<ProfessionalQuote[]> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const quotes: ProfessionalQuote[] = [];

  // 1. Direct Uniswap V3 Quotes (Professional Method)
  try {
    const uniswapConfig = DEX_CONFIGS.uniswap_v3;
    const quoter = new ethers.Contract(uniswapConfig.quoter, [
      "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
    ], provider);

    // Try all fee tiers
    for (const fee of uniswapConfig.feeTiers) {
      try {
        const result = await quoter.quoteExactInputSingle(
          tokenIn,
          tokenOut,
          fee,
          amountIn,
          0
        );

        if (result.amountOut > 0n) {
          quotes.push({
            dexId: "uniswap_v3",
            amountOut: result.amountOut.toString(),
            gasEstimate: result.gasEstimate.toString(),
            priceImpact: 0, // Calculate based on spot price
            route: ["Uniswap V3"],
            poolAddress: "", // Will be filled by pool discovery
            fee,
            liquidity: "0", // Will be filled by pool discovery
            confidence: "high"
          });
        }
      } catch (error) {
        // Pool doesn't exist or no liquidity
        continue;
      }
    }
  } catch (error) {
    console.log("⚠️ Uniswap V3 quote failed:", error);
  }

  // 2. 1inch API Integration (Professional Aggregator)
  try {
    const oneInchResponse = await fetch(
      `https://api.1inch.dev/swap/v5.2/8453/quote?src=${tokenIn}&dst=${tokenOut}&amount=${amountIn}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
          'Accept': 'application/json'
        }
      }
    );

    if (oneInchResponse.ok) {
      const oneInchData = await oneInchResponse.json();
      quotes.push({
        dexId: "1inch",
        amountOut: oneInchData.toAmount,
        gasEstimate: oneInchData.gas || "150000",
        priceImpact: parseFloat(oneInchData.priceImpact || "0"),
        route: oneInchData.protocols?.flat() || ["1inch"],
        poolAddress: "",
        fee: 0,
        liquidity: "0",
        confidence: "high"
      });
    }
  } catch (error) {
    console.log("⚠️ 1inch quote failed:", error);
  }

  // 3. 0x Protocol Integration (Professional Aggregator)
  try {
    const zeroXResponse = await fetch(
      `https://base.api.0x.org/swap/v1/quote?buyToken=${tokenOut}&sellToken=${tokenIn}&sellAmount=${amountIn}`,
      {
        headers: {
          '0x-api-key': process.env.ZEROX_API_KEY || ''
        }
      }
    );

    if (zeroXResponse.ok) {
      const zeroXData = await zeroXResponse.json();
      quotes.push({
        dexId: "0x",
        amountOut: zeroXData.buyAmount,
        gasEstimate: zeroXData.gas || "150000",
        priceImpact: parseFloat(zeroXData.priceImpact || "0"),
        route: zeroXData.sources?.map((s: any) => s.name) || ["0x"],
        poolAddress: "",
        fee: 0,
        liquidity: "0",
        confidence: "high"
      });
    }
  } catch (error) {
    console.log("⚠️ 0x quote failed:", error);
  }

  return quotes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
}

// Professional Route Selection
export async function selectBestRoute(
  quotes: ProfessionalQuote[],
  pools: Array<{ dexId: string; poolAddress: string; fee: number; liquidity: bigint }>
): Promise<ProfessionalQuote | null> {
  if (quotes.length === 0) return null;

  // Match quotes with actual pools
  const validatedQuotes = quotes.map(quote => {
    const matchingPool = pools.find(pool => 
      pool.dexId === quote.dexId && pool.fee === quote.fee
    );
    
    return {
      ...quote,
      poolAddress: matchingPool?.poolAddress || "",
      liquidity: matchingPool?.liquidity.toString() || "0"
    };
  });

  // Professional selection criteria:
  // 1. Highest output amount
  // 2. Sufficient liquidity
  // 3. Low price impact
  // 4. High confidence

  const bestQuote = validatedQuotes
    .filter(q => parseFloat(q.liquidity) > 1000) // Minimum liquidity
    .filter(q => q.priceImpact < 5) // Max 5% price impact
    .sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut))[0];

  return bestQuote || validatedQuotes[0];
}

// Professional Swap Execution
export async function executeProfessionalSwap(
  quote: ProfessionalQuote,
  walletAddress: string,
  slippage: number = 0.5
): Promise<{
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
}> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  
  // Calculate minimum output with slippage
  const amountOutMin = BigInt(quote.amountOut) * BigInt(1000 - slippage * 10) / 1000n;
  
  // Get router configuration
  const config = DEX_CONFIGS[quote.dexId as keyof typeof DEX_CONFIGS];
  
  if (!config) {
    throw new Error(`Unknown DEX: ${quote.dexId}`);
  }

  // Encode transaction based on DEX version
  let data = "0x";
  let value = "0";

  if (config.version === "v3") {
    const router = new ethers.Contract(config.router, [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
    ], provider);

    data = router.interface.encodeFunctionData("exactInputSingle", [{
      tokenIn: quote.route[0],
      tokenOut: quote.route[1],
      fee: quote.fee,
      recipient: walletAddress,
      deadline: Math.floor(Date.now() / 1000) + 1200,
      amountIn: "0", // Will be set by frontend
      amountOutMinimum: amountOutMin.toString(),
      sqrtPriceLimitX96: 0
    }]);
  }

  return {
    to: config.router,
    data,
    value,
    gasEstimate: quote.gasEstimate
  };
}
