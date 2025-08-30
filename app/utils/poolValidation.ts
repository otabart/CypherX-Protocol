import { ethers } from 'ethers';

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// DEX Factory Addresses on Base
const DEX_FACTORIES = {
  // Uniswap V3 is broken on Base chain - use Aerodrome instead
  aerodrome: {
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481", // Correct Aerodrome router
    abi: ["function getPair(address tokenA, address tokenB) external view returns (address pair)"],
    feeTiers: [3000] // Aerodrome uses 0.3% fee
  },
  // Uniswap V2 - Re-enabled since buy transactions are working on BaseScan
  uniswap_v2: {
    factory: "0x8909dc15e40173ff4699343b6eb8132c65e18ec6",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // Uniswap V2 router on Base
    abi: ["function getPair(address tokenA, address tokenB) external view returns (address pair)"],
    feeTiers: [3000] // 0.3% for V2
  },
  // Baseswap
  baseswap: {
    factory: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    router: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    abi: ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"],
    feeTiers: [100, 500, 3000, 10000]
  }
};

export interface PoolValidationResult {
  dexId: string;
  version: string;
  factory: string;
  router: string;
  poolAddress: string;
  fee: number;
  liquidity?: string;
  isValid: boolean;
  error?: string;
}

export interface TokenValidationResult {
  tokenAddress: string;
  availablePools: PoolValidationResult[];
  bestPool?: PoolValidationResult;
  totalLiquidity: string;
}

/**
 * Validates all available pools for a token pair across all supported DEXs
 */
export async function validateAllPools(
  tokenIn: string, 
  tokenOut: string
): Promise<TokenValidationResult> {
  console.log(`🔍 Validating pools for ${tokenIn} -> ${tokenOut}`);
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const results: PoolValidationResult[] = [];
  
  // Normalize token addresses (ETH -> WETH)
  const normalizedTokenIn = tokenIn === 'ETH' ? WETH_ADDRESS : tokenIn;
  const normalizedTokenOut = tokenOut === 'ETH' ? WETH_ADDRESS : tokenOut;
  
  // Check each DEX
  for (const [dexId, dexConfig] of Object.entries(DEX_FACTORIES)) {
    try {
      const factory = new ethers.Contract(dexConfig.factory, dexConfig.abi, provider);
      
      // Check each fee tier
      for (const fee of dexConfig.feeTiers) {
        try {
          let poolAddress: string;
          
          if (dexId === 'uniswap_v2' || dexId === 'aerodrome') {
            // V2-style DEXs use getPair instead of getPool
            poolAddress = await factory.getPair(normalizedTokenIn, normalizedTokenOut);
          } else {
            // V3-style DEXs use getPool with fee
            poolAddress = await factory.getPool(normalizedTokenIn, normalizedTokenOut, fee);
          }
          
          const isValid = poolAddress !== "0x0000000000000000000000000000000000000000";
          
          if (isValid) {
            console.log(`✅ Found ${dexId} pool: ${poolAddress} (fee: ${fee})`);
            
            results.push({
              dexId,
              version: dexId.includes('v3') ? 'v3' : dexId.includes('v2') ? 'v2' : 'v3-style',
              factory: dexConfig.factory,
              router: dexConfig.router,
              poolAddress,
              fee,
              isValid: true
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ Error checking ${dexId} fee ${fee}:`, errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ Error checking ${dexId}:`, errorMessage);
    }
  }
  
          // Find the best pool (prefer pools with liquidity, then lowest fee)
        let bestPool = undefined;
        
        if (results.length > 0) {
          // First try to find a pool with liquidity
          for (const pool of results) {
            try {
              let liquidity = 0n;
              
              if (pool.dexId === 'aerodrome' || pool.dexId === 'uniswap_v2') {
                // V2-style DEXs use reserves instead of liquidity
                const poolContract = new ethers.Contract(pool.poolAddress, [
                  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
                ], provider);
                const reserves = await poolContract.getReserves();
                liquidity = reserves.reserve0 + reserves.reserve1;
              } else {
                // V3-style DEXs use liquidity
                const poolContract = new ethers.Contract(pool.poolAddress, [
                  "function liquidity() external view returns (uint128)"
                ], provider);
                liquidity = await poolContract.liquidity();
              }
              
              if (liquidity > 0n) {
                bestPool = pool;
                console.log(`✅ Found pool with liquidity: ${pool.dexId} fee ${pool.fee} liquidity ${liquidity}`);
                break;
              } else {
                console.log(`⚠️ Pool ${pool.dexId} fee ${pool.fee} has 0 liquidity`);
              }
            } catch (error) {
              console.log(`⚠️ Could not check liquidity for ${pool.dexId} fee ${pool.fee}:`, error);
            }
          }
          
          // If no pool with liquidity found, try to find any pool and log it
          if (!bestPool) {
            bestPool = results[0];
            console.log(`⚠️ No pool with liquidity found, using first available: ${bestPool.dexId} fee ${bestPool.fee}`);
            
            // Log all available pools for debugging
            console.log("📋 All available pools:");
            results.forEach((pool, index) => {
              console.log(`  ${index + 1}. ${pool.dexId} fee ${pool.fee} address ${pool.poolAddress}`);
            });
          }
        }
  
  return {
    tokenAddress: tokenOut,
    availablePools: results,
    bestPool,
    totalLiquidity: results.length > 0 ? "Available" : "None"
  };
}

/**
 * Validates a specific pool exists and returns the correct router configuration
 */
export async function validateSpecificPool(
  dexId: string,
  tokenIn: string,
  tokenOut: string,
  fee?: number
): Promise<PoolValidationResult> {
  console.log(`🔍 Validating specific pool: ${dexId} ${tokenIn} -> ${tokenOut} (fee: ${fee})`);
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  
  // Normalize token addresses
  const normalizedTokenIn = tokenIn === 'ETH' ? WETH_ADDRESS : tokenIn;
  const normalizedTokenOut = tokenOut === 'ETH' ? WETH_ADDRESS : tokenOut;
  
  // Get DEX config
  const dexConfig = DEX_FACTORIES[dexId as keyof typeof DEX_FACTORIES];
  if (!dexConfig) {
    return {
      dexId,
      version: 'unknown',
      factory: '',
      router: '',
      poolAddress: '',
      fee: 0,
      isValid: false,
      error: `Unsupported DEX: ${dexId}`
    };
  }
  
  try {
    const factory = new ethers.Contract(dexConfig.factory, dexConfig.abi, provider);
    
    // Use provided fee or default to first available
    const checkFee = fee || dexConfig.feeTiers[0];
    
    let poolAddress: string;
    if (dexId === 'uniswap_v2') {
      poolAddress = await factory.getPair(normalizedTokenIn, normalizedTokenOut);
    } else {
      poolAddress = await factory.getPool(normalizedTokenIn, normalizedTokenOut, checkFee);
    }
    
    const isValid = poolAddress !== "0x0000000000000000000000000000000000000000";
    
    return {
      dexId,
      version: dexId.includes('v3') ? 'v3' : dexId.includes('v2') ? 'v2' : 'v3-style',
      factory: dexConfig.factory,
      router: dexConfig.router,
      poolAddress,
      fee: checkFee,
      isValid,
      error: isValid ? undefined : `No pool found for ${dexId} with fee ${checkFee}`
    };
     } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     return {
       dexId,
       version: 'unknown',
       factory: '',
       router: '',
       poolAddress: '',
       fee: 0,
       isValid: false,
       error: `Error validating pool: ${errorMessage}`
     };
   }
}

/**
 * Gets the correct router configuration for a validated pool
 */
export function getRouterConfig(poolResult: PoolValidationResult, isETHInput: boolean = false) {
  const { dexId, version, router, fee } = poolResult;
  
  // Handle Aerodrome specifically since it's V2-style but uses different method names
  if (dexId === 'aerodrome') {
    return {
      routerAddress: router,
      version: 'v2',
      fee,
      method: isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForTokens',
      dexId
    };
  }
  
  // Handle Uniswap V2 with standard V2 methods
  if (dexId === 'uniswap_v2') {
    return {
      routerAddress: router,
      version: 'v2',
      fee,
      method: isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForETHSupportingFeeOnTransferTokens',
      dexId
    };
  }
  
  // 🔧 ENHANCED: Add support for other DEXs that might handle problematic tokens better
  if (dexId === 'aerodrome') {
    return {
      routerAddress: router,
      version: 'v2',
      fee,
      method: isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForTokens',
      dexId
    };
  }
  
  if (dexId === 'baseswap') {
    return {
      routerAddress: router,
      version: 'v2',
      fee,
      method: isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForETHSupportingFeeOnTransferTokens',
      dexId
    };
  }
  
  return {
    routerAddress: router,
    version,
    fee,
    method: version === 'v3' ? 'exactInputSingle' : 
            version === 'v2' ? (isETHInput ? 'swapExactETHForTokens' : 'swapExactTokensForETH') : 
            'swap', // V3-style DEXs
    dexId
  };
}

/**
 * Validates that a route from DexScreener actually has a valid pool
 */
export async function validateDexScreenerRoute(route: any): Promise<PoolValidationResult> {
  const { dexId, steps } = route;
  const step = steps[0]; // DexScreener routes are single-hop
  
  console.log(`🔍 Validating DexScreener route: ${dexId} for ${step.tokenIn} -> ${step.tokenOut}`);
  
  // First, let's find all available pools for this token pair
  const allPools = await validateAllPools(step.tokenIn, step.tokenOut);
  
  if (allPools.availablePools.length === 0) {
    return {
      dexId: 'unknown',
      version: 'unknown',
      factory: '',
      router: '',
      poolAddress: '',
      fee: 0,
      isValid: false,
      error: 'No pools found for this token pair'
    };
  }
  
  // Find the best pool (with liquidity)
  const bestPool = allPools.bestPool;
  if (!bestPool) {
    return {
      dexId: 'unknown',
      version: 'unknown',
      factory: '',
      router: '',
      poolAddress: '',
      fee: 0,
      isValid: false,
      error: 'No pool with liquidity found'
    };
  }
  
  console.log(`✅ Using best pool: ${bestPool.dexId} with fee ${bestPool.fee}`);
  return bestPool;
}
