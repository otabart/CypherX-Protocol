import { ethers } from "ethers";

// Uniswap V3-style Swap System for CypherX
// Based on Uniswap V3 Core contracts architecture

// ────────────────────────────────────────────────────────────────────────────────
// 1. TYPES & INTERFACES
// ────────────────────────────────────────────────────────────────────────────────

export interface Pool {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  dexId: string;
  version: "v3" | "v2";
}

export interface SwapRoute {
  pools: Pool[];
  path: string[];
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
  priceImpact: number;
  fee: number;
  dexId: string;
}

export interface ConcentratedLiquidityPosition {
  poolAddress: string;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  deadline: number;
  sqrtPriceLimitX96?: bigint;
  slippageTolerance: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// 2. CONSTANTS & CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────────

const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// Fee tiers (in basis points) - matching Uniswap V3
export const FEE_TIERS = {
  TIER_1: 100,   // 0.01%
  TIER_2: 500,   // 0.05%
  TIER_3: 3000,  // 0.3%
  TIER_4: 10000  // 1%
} as const;

// Tick spacing for each fee tier
export const TICK_SPACING = {
  [FEE_TIERS.TIER_1]: 1,
  [FEE_TIERS.TIER_2]: 10,
  [FEE_TIERS.TIER_3]: 60,
  [FEE_TIERS.TIER_4]: 200
} as const;

// DEX configurations with Uniswap V3-style features
export const DEX_CONFIGS = {
  uniswap_v3: {
    factory: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
    quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    feeTiers: [FEE_TIERS.TIER_1, FEE_TIERS.TIER_2, FEE_TIERS.TIER_3, FEE_TIERS.TIER_4],
    version: "v3" as const,
    tickSpacing: TICK_SPACING
  },
  aerodrome: {
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    router: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    feeTiers: [FEE_TIERS.TIER_3], // Only 0.3% fee tier
    version: "v2" as const,
    tickSpacing: { [FEE_TIERS.TIER_3]: 60 }
  },
  baseswap: {
    factory: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    router: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
    feeTiers: [FEE_TIERS.TIER_3], // Only 0.3% fee tier
    version: "v2" as const,
    tickSpacing: { [FEE_TIERS.TIER_3]: 60 }
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// 3. MATH UTILITIES (Based on Uniswap V3 FullMath)
// ────────────────────────────────────────────────────────────────────────────────

export class FullMath {
  static mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
    if (denominator === 0n) throw new Error("FullMath: DIVISION_BY_ZERO");
    
    const product = a * b;
    if (product === 0n) return 0n;
    
    if (product / a !== b) throw new Error("FullMath: MULTIPLICATION_OVERFLOW");
    
    if (product < denominator) return 0n;
    
    return product / denominator;
  }
  
  static mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
    const result = FullMath.mulDiv(a, b, denominator);
    if (a * b % denominator > 0n) return result + 1n;
    return result;
  }
}

export class SqrtPriceMath {
  static getNextSqrtPriceFromInput(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    amountIn: bigint,
    zeroForOne: boolean
  ): bigint {
    if (sqrtPriceX96 === 0n) throw new Error("SqrtPriceMath: ZERO_PRICE");
    if (liquidity === 0n) throw new Error("SqrtPriceMath: ZERO_LIQUIDITY");
    
    if (zeroForOne) {
      return this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPriceX96, liquidity, amountIn, true);
    } else {
      return this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPriceX96, liquidity, amountIn, true);
    }
  }
  
  private static getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (amount === 0n) return sqrtPriceX96;
    
    const numerator1 = liquidity << 96n;
    const product = amount * sqrtPriceX96;
    
    if (add) {
      if (product / amount === sqrtPriceX96) {
        const denominator = numerator1 + product;
        if (denominator >= numerator1) {
          return FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
        }
      }
      return FullMath.mulDivRoundingUp(numerator1, 1n, (numerator1 / sqrtPriceX96) + amount);
    } else {
      if (product / amount !== sqrtPriceX96) throw new Error("SqrtPriceMath: MULTIPLICATION_OVERFLOW");
      if (numerator1 <= product) throw new Error("SqrtPriceMath: PRICE_UNDERFLOW");
      const denominator = numerator1 - product;
      return FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
    }
  }
  
  private static getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (add) {
      const quotient = amount <= Number.MAX_SAFE_INTEGER 
        ? (amount << 96n) / liquidity 
        : FullMath.mulDiv(amount, 1n << 96n, liquidity);
      return sqrtPriceX96 + quotient;
    } else {
      const quotient = amount <= Number.MAX_SAFE_INTEGER
        ? FullMath.mulDivRoundingUp(amount, 1n << 96n, liquidity)
        : (amount << 96n) / liquidity;
      if (sqrtPriceX96 <= quotient) throw new Error("SqrtPriceMath: PRICE_UNDERFLOW");
      return sqrtPriceX96 - quotient;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 4. POOL DISCOVERY & MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────────

export class PoolManager {
  private provider: ethers.Provider;
  // private _pools: Map<string, Pool> = new Map();
  
  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }
  
  async discoverPools(token0: string, token1: string): Promise<Pool[]> {
    const discoveredPools: Pool[] = [];
    
    for (const [dexId, config] of Object.entries(DEX_CONFIGS)) {
      if (config.version === "v3") {
        // For V3-style DEXs, check multiple fee tiers
        for (const fee of config.feeTiers) {
          const poolAddress = await this.getPoolAddress(dexId, token0, token1, fee);
          if (poolAddress && poolAddress !== ethers.ZeroAddress) {
            const pool = await this.getPoolInfo(poolAddress, dexId, fee);
            if (pool && pool.liquidity > 0n) {
              discoveredPools.push(pool);
            }
          }
        }
      } else {
        // For V2-style DEXs, check single fee tier
        const fee = config.feeTiers[0];
        const poolAddress = await this.getPoolAddress(dexId, token0, token1, fee);
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
                  const pool = await this.getPoolInfo(poolAddress, dexId, fee);
        if (pool && pool.liquidity > 0n) {
          discoveredPools.push(pool);
        }
        }
      }
    }
    
    return discoveredPools;
  }
  
  private async getPoolAddress(dexId: string, token0: string, token1: string, fee: number): Promise<string> {
    try {
      const config = DEX_CONFIGS[dexId as keyof typeof DEX_CONFIGS];
      const factory = new ethers.Contract(config.factory, [
        "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
      ], this.provider);
      
      return await factory.getPool(token0, token1, fee);
    } catch (error) {
      console.error(`Error getting pool address for ${dexId}:`, error);
      return ethers.ZeroAddress;
    }
  }
  
  private async getPoolInfo(poolAddress: string, dexId: string, fee: number): Promise<Pool | null> {
    try {
      const config = DEX_CONFIGS[dexId as keyof typeof DEX_CONFIGS];
      
      if (config.version === "v3") {
        return await this.getV3PoolInfo(poolAddress, dexId, fee);
      } else {
        return await this.getV2PoolInfo(poolAddress, dexId, fee);
      }
    } catch (error) {
      console.error(`Error getting pool info for ${poolAddress}:`, error);
      return null;
    }
  }
  
  private async getV3PoolInfo(poolAddress: string, dexId: string, _fee: number): Promise<Pool | null> {
    try {
      const pool = new ethers.Contract(poolAddress, [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)",
        "function tickSpacing() external view returns (int24)",
        "function liquidity() external view returns (uint128)",
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
      ], this.provider);
      
      const [token0, token1, poolFee, tickSpacing, liquidity, slot0] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.tickSpacing(),
        pool.liquidity(),
        pool.slot0()
      ]);
      
      return {
        address: poolAddress,
        token0,
        token1,
        fee: Number(poolFee),
        tickSpacing: Number(tickSpacing),
        liquidity,
        sqrtPriceX96: slot0[0],
        tick: Number(slot0[1]),
        dexId,
        version: "v3"
      };
    } catch (error) {
      console.error(`Error getting V3 pool info:`, error);
      return null;
    }
  }
  
  private async getV2PoolInfo(poolAddress: string, dexId: string, fee: number): Promise<Pool | null> {
    try {
      const pool = new ethers.Contract(poolAddress, [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
      ], this.provider);
      
      const [token0, token1, reserves] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.getReserves()
      ]);
      
      // For V2 pools, calculate sqrtPriceX96 from reserves
      const sqrtPriceX96 = this.calculateSqrtPriceX96FromReserves(reserves[0], reserves[1]);
      
      return {
        address: poolAddress,
        token0,
        token1,
        fee,
        tickSpacing: (DEX_CONFIGS[dexId as keyof typeof DEX_CONFIGS].tickSpacing as any)[fee],
        liquidity: reserves[0] + reserves[1], // Simplified for V2
        sqrtPriceX96,
        tick: this.getTickFromSqrtPriceX96(sqrtPriceX96),
        dexId,
        version: "v2"
      };
    } catch (error) {
      console.error(`Error getting V2 pool info:`, error);
      return null;
    }
  }
  
  private calculateSqrtPriceX96FromReserves(reserve0: bigint, reserve1: bigint): bigint {
    if (reserve0 === 0n || reserve1 === 0n) return 0n;
    const price = (reserve1 << 192n) / reserve0;
    return this.sqrt(price);
  }
  
  private sqrt(value: bigint): bigint {
    if (value < 0n) throw new Error("Sqrt: NEGATIVE_VALUE");
    if (value === 0n) return 0n;
    
    let z = value;
    let x = value / 2n + 1n;
    while (x < z) {
      z = x;
      x = (value / x + x) / 2n;
    }
    return z;
  }
  
  private getTickFromSqrtPriceX96(sqrtPriceX96: bigint): number {
    const price = Number(sqrtPriceX96) / 2**96;
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 5. ROUTING ENGINE (Based on Uniswap V3 Router)
// ────────────────────────────────────────────────────────────────────────────────

export class SwapRouter {
  private provider: ethers.Provider;
  private poolManager: PoolManager;
  
  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.poolManager = new PoolManager(provider);
  }
  
  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageTolerance: number = 0.5
  ): Promise<SwapRoute | null> {
    console.log(`🔍 Finding best route for ${ethers.formatEther(amountIn)} tokens`);
    
    // Discover all available pools
    const pools = await this.poolManager.discoverPools(tokenIn, tokenOut);
    console.log(`Found ${pools.length} pools for ${tokenIn} -> ${tokenOut}`);
    
    if (pools.length === 0) {
      console.log("No pools found for this token pair");
      return null;
    }
    
    // Get quotes from all pools
    const quotes = await Promise.all(
      pools.map(pool => this.getQuote(pool, amountIn))
    );
    
    // Filter out failed quotes
    const validQuotes = quotes.filter(quote => quote !== null) as SwapRoute[];
    
    if (validQuotes.length === 0) {
      console.log("No valid quotes found");
      return null;
    }
    
    // Select best route based on output amount and gas costs
    const bestRoute = this.selectBestRoute(validQuotes);
    
    // Apply slippage tolerance
    const amountOutMin = bestRoute.amountOut * BigInt(1000 - Math.floor(slippageTolerance * 10)) / 1000n;
    
    return {
      ...bestRoute,
      amountOut: amountOutMin
    };
  }
  
  private async getQuote(pool: Pool, amountIn: bigint): Promise<SwapRoute | null> {
    try {
      const config = DEX_CONFIGS[pool.dexId as keyof typeof DEX_CONFIGS];
      
      if (config.version === "v3") {
        return await this.getV3Quote(pool, amountIn);
      } else {
        return await this.getV2Quote(pool, amountIn);
      }
    } catch (error) {
      console.error(`Error getting quote for pool ${pool.address}:`, error);
      return null;
    }
  }
  
  private async getV3Quote(pool: Pool, amountIn: bigint): Promise<SwapRoute | null> {
    try {
      const config = DEX_CONFIGS[pool.dexId as keyof typeof DEX_CONFIGS];
      if (config.version !== "v3" || !('quoter' in config)) {
        console.log(`DEX ${pool.dexId} does not support V3 quotes`);
        return null;
      }
      const quoter = new ethers.Contract((config as any).quoter, [
        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
      ], this.provider);
      
      const amountOut = await quoter.quoteExactInputSingle(
        pool.token0,
        pool.token1,
        pool.fee,
        amountIn,
        0 // sqrtPriceLimitX96
      );
      
      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(amountIn, amountOut, pool);
      
      // Estimate gas (simplified)
      const gasEstimate = 200000n; // Base estimate for V3 swaps
      
      return {
        pools: [pool],
        path: [pool.token0, pool.token1],
        amountIn,
        amountOut,
        gasEstimate,
        priceImpact,
        fee: pool.fee,
        dexId: pool.dexId
      };
    } catch (error) {
      console.error(`Error getting V3 quote:`, error);
      return null;
    }
  }
  
  private async getV2Quote(pool: Pool, amountIn: bigint): Promise<SwapRoute | null> {
    try {
      const config = DEX_CONFIGS[pool.dexId as keyof typeof DEX_CONFIGS];
      const router = new ethers.Contract(config.router, [
        "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
      ], this.provider);
      
      const amounts = await router.getAmountsOut(amountIn, [pool.token0, pool.token1]);
      const amountOut = amounts[1];
      
      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(amountIn, amountOut, pool);
      
      // Estimate gas (simplified)
      const gasEstimate = 150000n; // Base estimate for V2 swaps
      
      return {
        pools: [pool],
        path: [pool.token0, pool.token1],
        amountIn,
        amountOut,
        gasEstimate,
        priceImpact,
        fee: pool.fee,
        dexId: pool.dexId
      };
    } catch (error) {
      console.error(`Error getting V2 quote:`, error);
      return null;
    }
  }
  
  private calculatePriceImpact(amountIn: bigint, amountOut: bigint, pool: Pool): number {
    // Simplified price impact calculation
    const expectedPrice = pool.sqrtPriceX96;
    const actualPrice = (amountOut << 192n) / amountIn;
    const impact = Number((expectedPrice - actualPrice) * 10000n / expectedPrice) / 100;
    return Math.abs(impact);
  }
  
  private selectBestRoute(routes: SwapRoute[]): SwapRoute {
    // Sort by effective output (considering gas costs)
    const routesWithEffectiveOutput = routes.map(route => {
      const gasCost = route.gasEstimate * 20n * 10n**9n; // Assume 20 gwei gas price
      const effectiveOutput = route.amountOut - gasCost;
      return { ...route, effectiveOutput };
    });
    
    routesWithEffectiveOutput.sort((a, b) => {
      if (b.effectiveOutput > a.effectiveOutput) return 1;
      if (b.effectiveOutput < a.effectiveOutput) return -1;
      return 0;
    });
    
    return routesWithEffectiveOutput[0];
  }
  
  async executeSwap(
    route: SwapRoute,
    params: SwapParams,
    signer: ethers.Signer
  ): Promise<ethers.ContractTransactionResponse> {
    const config = DEX_CONFIGS[route.dexId as keyof typeof DEX_CONFIGS];
    
    if (config.version === "v3") {
      return this.executeV3Swap(route, params, signer);
    } else {
      return this.executeV2Swap(route, params, signer);
    }
  }
  
  private async executeV3Swap(
    route: SwapRoute,
    params: SwapParams,
    signer: ethers.Signer
  ): Promise<ethers.ContractTransactionResponse> {
    const config = DEX_CONFIGS[route.dexId as keyof typeof DEX_CONFIGS];
    const router = new ethers.Contract(config.router, [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
    ], signer);
    
    const swapParams = {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: route.fee,
      recipient: params.recipient,
      deadline: params.deadline,
      amountIn: params.amountIn,
      amountOutMinimum: route.amountOut,
      sqrtPriceLimitX96: params.sqrtPriceLimitX96 || 0
    };
    
    const isETHInput = params.tokenIn === WETH_ADDRESS;
    const value = isETHInput ? params.amountIn : 0n;
    
    return router.exactInputSingle(swapParams, { value });
  }
  
  private async executeV2Swap(
    route: SwapRoute,
    params: SwapParams,
    signer: ethers.Signer
  ): Promise<ethers.ContractTransactionResponse> {
    const config = DEX_CONFIGS[route.dexId as keyof typeof DEX_CONFIGS];
    const router = new ethers.Contract(config.router, [
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
    ], signer);
    
    const isETHInput = params.tokenIn === WETH_ADDRESS;
    const method = isETHInput ? "swapExactETHForTokens" : "swapExactTokensForTokens";
    const args = isETHInput 
      ? [route.amountOut, route.path, params.recipient, params.deadline]
      : [params.amountIn, route.amountOut, route.path, params.recipient, params.deadline];
    
    const value = isETHInput ? params.amountIn : 0n;
    
    return router[method](...args, { value });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 6. CONCENTRATED LIQUIDITY MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────────

export class ConcentratedLiquidityManager {
  // private _provider: ethers.Provider;
  
      constructor(_provider: ethers.Provider) {
      // this._provider = provider;
    }
  
  async createPosition(
    _poolAddress: string,
    _tickLower: number,
    _tickUpper: number,
    _amount0Desired: bigint,
    _amount1Desired: bigint,
    _amount0Min: bigint,
    _amount1Min: bigint,
    _recipient: string,
    _deadline: number,
    _signer: ethers.Signer
  ): Promise<ethers.ContractTransactionResponse> {
    // This would integrate with Uniswap V3's NonfungiblePositionManager
    // For now, we'll provide the interface
    throw new Error("Concentrated liquidity positions not yet implemented");
  }
  
  calculateLiquidityForAmounts(
    sqrtPriceX96: bigint,
    sqrtPriceAX96: bigint,
    sqrtPriceBX96: bigint,
    amount0: bigint,
    amount1: bigint
  ): bigint {
    // Calculate liquidity based on Uniswap V3 formulas
    if (sqrtPriceAX96 > sqrtPriceBX96) {
      [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
    }
    
    if (sqrtPriceX96 <= sqrtPriceAX96) {
      return this.getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0);
    } else if (sqrtPriceX96 >= sqrtPriceBX96) {
      return this.getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1);
    } else {
      const liquidity0 = this.getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
      const liquidity1 = this.getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
      return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
    }
  }
  
  private getLiquidityForAmount0(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount0: bigint): bigint {
    const numerator = amount0 * (sqrtPriceBX96 - sqrtPriceAX96);
    const denominator = sqrtPriceBX96;
    return FullMath.mulDiv(numerator, 1n << 96n, denominator);
  }
  
  private getLiquidityForAmount1(sqrtPriceAX96: bigint, sqrtPriceBX96: bigint, amount1: bigint): bigint {
    return FullMath.mulDiv(amount1, 1n << 96n, sqrtPriceBX96 - sqrtPriceAX96);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 7. MAIN EXPORT
// ────────────────────────────────────────────────────────────────────────────────

export class CypherXSwapV3 {
  private provider: ethers.Provider;
  private router: SwapRouter;
  private liquidityManager: ConcentratedLiquidityManager;
  
  constructor(rpcUrl?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl || BASE_RPC_URL);
    this.router = new SwapRouter(this.provider);
    this.liquidityManager = new ConcentratedLiquidityManager(this.provider);
  }
  
  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageTolerance: number = 0.5
  ): Promise<{
    route: SwapRoute;
    amountOut: string;
    priceImpact: number;
    gasEstimate: string;
    dexId: string;
  } | null> {
    const amountInWei = ethers.parseEther(amountIn);
    const route = await this.router.findBestRoute(tokenIn, tokenOut, amountInWei, slippageTolerance);
    
    if (!route) return null;
    
    return {
      route,
      amountOut: ethers.formatEther(route.amountOut),
      priceImpact: route.priceImpact,
      gasEstimate: route.gasEstimate.toString(),
      dexId: route.dexId
    };
  }
  
  async executeSwap(
    route: SwapRoute,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    recipient: string,
    slippageTolerance: number = 0.5,
    signer: ethers.Signer
  ): Promise<ethers.ContractTransactionResponse> {
    const amountInWei = ethers.parseEther(amountIn);
    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
    
    const params: SwapParams = {
      tokenIn,
      tokenOut,
      amountIn: amountInWei,
      recipient,
      deadline,
      slippageTolerance
    };
    
    return this.router.executeSwap(route, params, signer);
  }
  
  getLiquidityManager(): ConcentratedLiquidityManager {
    return this.liquidityManager;
  }
}

export default CypherXSwapV3;
