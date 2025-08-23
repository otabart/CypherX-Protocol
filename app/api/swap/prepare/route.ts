import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { validateDexScreenerRoute, getRouterConfig } from "../../../utils/poolValidation";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

// Function to find route using DexScreener (same logic as quote API)
async function findDexScreenerRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  quoteDex?: string
): Promise<any> {
  console.log("🔍 Finding DexScreener route for:", { tokenIn, tokenOut, amountIn: amountIn.toString() });
  
  try {
    // Convert amountIn to decimal string for calculations
    const amountInDecimal = ethers.formatUnits(amountIn, 18);
    console.log("🔍 Amount in decimal:", amountInDecimal);
    
    // Get token addresses (handle ETH case)
    const tokenInAddress = tokenIn === 'ETH' ? '0x4200000000000000000000000000000000000006' : tokenIn;
    const tokenOutAddress = tokenOut === 'ETH' ? '0x4200000000000000000000000000000000000006' : tokenOut;
    console.log("🔍 Token addresses:", { tokenInAddress, tokenOutAddress });
    
    // Get DexScreener data for both tokens
    console.log("🔍 Fetching DexScreener data...");
    const [inputTokenResponse, outputTokenResponse] = await Promise.all([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenInAddress}`),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenOutAddress}`)
    ]);
    
    if (!inputTokenResponse.ok || !outputTokenResponse.ok) {
      throw new Error(`DexScreener API error: ${inputTokenResponse.status} ${outputTokenResponse.status}`);
    }
    
    const inputTokenData = await inputTokenResponse.json();
    const outputTokenData = await outputTokenResponse.json();
    console.log("🔍 DexScreener responses received");
    
    // Combine and find matching pairs
    const allPairs = [
      ...(inputTokenData.pairs || []),
      ...(outputTokenData.pairs || [])
    ];
    console.log("🔍 Total pairs found:", allPairs.length);
    
    // Find exact pair matches
    const exactPairs = allPairs.filter((pair: any) => {
      try {
        return (pair.baseToken?.address?.toLowerCase() === tokenInAddress.toLowerCase() && 
               pair.quoteToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase()) ||
              (pair.baseToken?.address?.toLowerCase() === tokenOutAddress.toLowerCase() && 
               pair.quoteToken?.address?.toLowerCase() === tokenInAddress.toLowerCase());
      } catch (error) {
        console.log("⚠️ Error filtering pair:", error, pair);
        return false;
      }
    });
    console.log("🔍 Exact pairs found:", exactPairs.length);
    
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
    
    if (sortedPairs.length === 0) {
      console.log("❌ No DexScreener pairs found");
      return null;
    }
    
    // Use the best pair (highest liquidity)
    const bestPair = sortedPairs[0];
    console.log("🏆 Best pair selected:", {
      dexId: bestPair.dexId,
      pairAddress: bestPair.pairAddress,
      liquidity: bestPair.liquidity?.usd
    });
    
    // Calculate output amount based on pair price
    const pairPrice = parseFloat(bestPair.priceUsd || "0");
    const liquidity = parseFloat(bestPair.liquidity?.usd || "0");
    
    console.log("🔍 Pair data:", { pairPrice, liquidity, amountInDecimal });
    
    if (pairPrice <= 0 || liquidity <= 0) {
      console.log("❌ Invalid pair data:", { pairPrice, liquidity });
      return null;
    }
    
    // Get real ETH price for calculation
    let ethPrice = 0;
    try {
      // Try DexScreener first (most reliable and no rate limits)
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
          ethPrice = parseFloat(wethUsdcPair.priceUsd);
          console.log("✅ ETH price from DexScreener WETH/USDC:", ethPrice);
        } else {
          // Fallback to any WETH pair with price on Base
          const wethPair = dexData.pairs.find((pair: any) => 
            pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
            pair.priceUsd && 
            pair.chainId === "base"
          );
          if (wethPair?.priceUsd) {
            ethPrice = parseFloat(wethPair.priceUsd);
            console.log("✅ ETH price from DexScreener Base chain:", ethPrice);
          }
        }
      }
      
      // If DexScreener failed, try other sources
      if (ethPrice <= 0) {
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
            const response = await fetch(api.url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'CypherX/1.0'
              },
              signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) continue;
            
            const data = await response.json();
            const price = api.parser(data);
            
            if (price && price > 0) {
              ethPrice = price;
              console.log(`✅ ETH price from ${api.name}:`, ethPrice);
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      if (ethPrice <= 0) {
        throw new Error("Failed to fetch real ETH price from all sources");
      }
    } catch (error) {
      console.error("❌ Failed to get real ETH price:", error);
      throw new Error("Failed to fetch real ETH price - cannot prepare swap");
    }
    
    // Calculate estimated output
    const amountInValue = parseFloat(amountInDecimal) * ethPrice;
    const estimatedOutput = amountInValue / pairPrice;
    
    console.log("🔍 Output calculation:", { amountInValue, estimatedOutput });
    
    // Apply slippage
    const slippage = 0.005; // 0.5% base slippage
    const finalOutput = estimatedOutput * (1 - slippage);
    
    console.log("🔍 Final output:", { finalOutput, slippage });
    
    // Convert to wei
    const outputAmountWei = ethers.parseUnits(finalOutput.toString(), 18);
    console.log("🔍 Output in wei:", outputAmountWei.toString());
    
    // Get gas estimate based on DEX (will be updated with correct DEX later)
    let gasEstimate = 150000n;
    
    // 🔧 FIXED: Use the same DEX that the quote API used to ensure consistency
    let correctFee = 3000; // Default fallback
    let correctPoolAddress = bestPair.pairAddress;
    let correctDexId = bestPair.dexId || "unknown";
    
    // 🔧 PRIORITIZE: Use the DEX from the quote API if provided
    if (quoteDex) {
      console.log("✅ Using DEX from quote API for consistency:", quoteDex);
      correctDexId = quoteDex;
      
      // Try to find a pair with the same DEX
      const sameDexPair = sortedPairs.find((pair: any) => pair.dexId === quoteDex);
      if (sameDexPair) {
        correctPoolAddress = sameDexPair.pairAddress;
        console.log("✅ Found matching pair for quote DEX:", {
          dexId: correctDexId,
          poolAddress: correctPoolAddress
        });
      } else {
        console.log("⚠️ No matching pair found for quote DEX, using best available");
      }
    } else {
      // Use the DEX from the best pair found by DexScreener (same as quote API)
      console.log("✅ Using DEX from DexScreener (same as quote API):", {
        dexId: correctDexId,
        fee: correctFee,
        poolAddress: correctPoolAddress
      });
    }
    
    // Only validate pools if we need to get additional info, but prioritize the DEX from quote
    try {
      const { validateAllPools } = await import('../../../utils/poolValidation');
      const poolValidation = await validateAllPools(tokenInAddress, tokenOutAddress);
      
      // Only use pool validation if it confirms the same DEX or if DexScreener DEX is invalid
      if (poolValidation.bestPool && poolValidation.bestPool.isValid) {
        const poolValidationDex = poolValidation.bestPool.dexId;
        
        // If pool validation suggests a different DEX, log it but stick with DexScreener DEX
        if (poolValidationDex !== correctDexId) {
          console.log("⚠️ Pool validation suggests different DEX:", {
            quoteDex: correctDexId,
            poolValidationDex: poolValidationDex
          });
          console.log("✅ Sticking with quote DEX for consistency");
        } else {
          // Same DEX, use pool validation for additional details
          correctFee = poolValidation.bestPool.fee;
          correctPoolAddress = poolValidation.bestPool.poolAddress;
          console.log("✅ Pool validation confirms quote DEX:", {
            dexId: correctDexId,
            fee: correctFee,
            poolAddress: correctPoolAddress
          });
        }
      } else {
        console.log("⚠️ Pool validation failed, using DexScreener DEX");
      }
    } catch (error) {
      console.log("⚠️ Pool validation failed, using DexScreener DEX:", error);
    }
    
    // Update gas estimate based on correct DEX
    if (correctDexId.includes("uniswap")) gasEstimate = 180000n;
    if (correctDexId.includes("aerodrome")) gasEstimate = 200000n;
    if (correctDexId.includes("baseswap")) gasEstimate = 180000n;
    
    return {
      steps: [{
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        fee: correctFee,
        poolAddress: correctPoolAddress,
        liquidity: liquidity.toString(),
        dexId: correctDexId
      }],
      totalAmountOut: outputAmountWei,
      gasEstimate: gasEstimate,
      dexId: correctDexId,
      pairAddress: correctPoolAddress
    };
    
  } catch (error) {
    console.error("❌ DexScreener route finding failed:", error);
    return null;
  }
}

interface PrepareSwapRequest {
  inputToken: string;
  outputToken: string;
  amountIn?: string | bigint;
  inputAmount?: string | bigint;
  slippage?: number;
  walletAddress: string;
  tokenAddress?: string;
  dex?: string;
  quoteDex?: string; // 🔧 NEW: DEX used in the quote for consistency
}



export async function POST(request: Request) {
  try {
    console.log("🔄 Prepare swap request received");
    
    const body: PrepareSwapRequest = await request.json();
    console.log("📋 Request body:", JSON.stringify(body, null, 2));
    const { inputToken, outputToken, amountIn: amountInRaw, inputAmount: inputAmountRaw, slippage = 0.5, walletAddress, quoteDex } = body;

    // Handle both amountIn and inputAmount fields
    const amountRaw = amountInRaw || inputAmountRaw;
    if (!amountRaw) {
      console.log("❌ Missing amount parameter");
      return NextResponse.json({
        success: false,
        error: "MISSING_AMOUNT",
        message: "Missing amountIn or inputAmount parameter"
      }, { status: 400 });
    }

    // Convert amountIn to wei (bigint)
    let amountIn: bigint;
    try {
      if (typeof amountRaw === 'string') {
        // Convert decimal string to wei (assuming 18 decimals for ETH/WETH)
        const { ethers } = await import('ethers');
        amountIn = ethers.parseUnits(amountRaw, 18);
        console.log("✅ Amount converted:", {
          original: amountRaw,
          wei: amountIn.toString()
        });
      } else {
        amountIn = amountRaw;
        console.log("✅ Amount already bigint:", amountIn.toString());
      }
    } catch (error) {
      console.log("❌ Invalid amount format:", error);
      return NextResponse.json({
        success: false,
        error: "INVALID_AMOUNT_FORMAT",
        message: "Amount must be a valid decimal number (e.g., 0.0003)"
      }, { status: 400 });
    }

    console.log("🔄 Preparing swap:", {
      inputToken,
      outputToken,
      amountIn: amountIn.toString(),
      slippage,
      walletAddress
    });

    // Validate inputs
    if (!inputToken || !outputToken || !walletAddress) {
      console.log("❌ Missing required parameters");
      return NextResponse.json({
        success: false,
        error: "MISSING_PARAMETERS",
        message: "Missing required parameters for swap preparation"
      }, { status: 400 });
    }

    // Validate amount
    if (amountIn <= 0n) {
      console.log("❌ Invalid amount");
      return NextResponse.json({
        success: false,
        error: "INVALID_AMOUNT",
        message: "Amount must be greater than 0"
      }, { status: 400 });
    }

    console.log("🔍 Finding multi-hop route...");
    console.log("🔍 Route parameters:", {
      inputToken,
      outputToken,
      amountIn: amountIn.toString()
    });
    
    // Find route using DexScreener (same logic as quote API)
    let route;
    try {
      route = await findDexScreenerRoute(inputToken, outputToken, amountIn, quoteDex);
      console.log("🔍 Route finding completed:", route ? "Route found" : "No route found");
    } catch (routeError) {
      console.error("❌ Route finding error:", routeError);
      return NextResponse.json({
        success: false,
        error: "ROUTE_FINDING_FAILED",
        message: "Failed to find a valid trading route",
        details: {
          error: routeError instanceof Error ? routeError.message : String(routeError)
        }
      }, { status: 500 });
    }
    
    if (!route) {
      console.log("❌ No valid route found");
      
      return NextResponse.json({
        success: false,
        error: "NO_VALID_ROUTE",
        message: "No valid trading route found for this token pair. The tokens may not have sufficient liquidity or may not be directly tradeable.",
        details: {
          suggestion: "Try a different token pair or check if the tokens are listed on Uniswap V3"
        }
      }, { status: 400 });
    }

    console.log("✅ Route found:", {
      steps: route.steps.length,
      totalAmountOut: route.totalAmountOut.toString(),
      gasEstimate: route.gasEstimate.toString()
    });

    // Calculate amount out minimum with slippage
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOutMinimum = (route.totalAmountOut * BigInt(Math.floor(slippageMultiplier * 1000))) / 1000n;
    
    // 🔧 CRITICAL: Debug slippage calculation
    console.log("🔍 Slippage calculation:", {
      totalAmountOut: route.totalAmountOut.toString(),
      totalAmountOutFormatted: ethers.formatEther(route.totalAmountOut),
      slippage: slippage,
      slippageMultiplier: slippageMultiplier,
      slippagePercentage: (slippage) + "%",
      amountOutMinimum: amountOutMinimum.toString(),
      amountOutMinimumFormatted: ethers.formatEther(amountOutMinimum),
      difference: ethers.formatEther(route.totalAmountOut - amountOutMinimum)
    });

    // Set deadline (30 minutes from now to account for user interaction time)
    const deadline = Math.floor(Date.now() / 1000) + 1800;

    // Prepare transaction data for DexScreener route
    let transactionData: any;
    let value: bigint;
    let routerAddress: string;

    // Validate the route using comprehensive pool validation
    console.log("🔍 Validating route with comprehensive pool validation...");
    
    const poolValidation = await validateDexScreenerRoute(route);
    
    if (!poolValidation.isValid) {
      throw new Error(`Pool validation failed: ${poolValidation.error}`);
    }
    
    console.log("✅ Pool validation successful:", {
      dexId: poolValidation.dexId,
      version: poolValidation.version,
      poolAddress: poolValidation.poolAddress,
      fee: poolValidation.fee
    });
    
    // Determine if this is an ETH swap (input token is ETH, WETH, or ETH address)
    const isETHInput = route.steps[0].tokenIn === 'ETH' || 
                      route.steps[0].tokenIn === WETH_ADDRESS || 
                      route.steps[0].tokenIn === ETH_ADDRESS ||
                      route.steps[0].tokenIn.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
                      route.steps[0].tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
    
    // Get router configuration based on validated pool and swap direction
    const routerConfig = getRouterConfig(poolValidation, isETHInput);
    
    console.log("🔧 Router configuration:", {
      dexId: routerConfig.dexId,
      version: routerConfig.version,
      routerAddress: routerConfig.routerAddress,
      method: routerConfig.method,
      fee: routerConfig.fee
    });
    
    // 🔧 CRITICAL: Debug liquidity and trade size
    console.log("🔍 Liquidity and trade size analysis:", {
      inputAmount: amountIn,
      inputAmountFormatted: ethers.formatUnits(amountIn, 18),
      routeLiquidity: route.liquidity,
      routeGasEstimate: route.gasEstimate,
      poolValidationLiquidity: poolValidation.liquidity,
      isETHInput,
      method: routerConfig.method
    });

    console.log("🔍 Pool validation completed successfully");
    

    
    // Set router address and prepare transaction data based on DEX version
    routerAddress = routerConfig.routerAddress;
    const step = route.steps[0];
    
    console.log("🔍 Step data:", {
      tokenIn: step.tokenIn,
      tokenOut: step.tokenOut,
      isETHInput,
      WETH_ADDRESS,
      ETH_ADDRESS
    });
    
    if (routerConfig.version === 'v3') {
      // Uniswap V3 style (broken on Base chain)
      const tokenIn = isETHInput ? WETH_ADDRESS : step.tokenIn;
      const tokenOut = step.tokenOut === 'ETH' ? WETH_ADDRESS : step.tokenOut;
      
      transactionData = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: routerConfig.fee,
        recipient: walletAddress,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0
      };
      value = isETHInput ? amountIn : 0n;
    } else if (routerConfig.version === 'v2') {
      // V2 style (Uniswap V2, Aerodrome, etc.)
      const tokenIn = isETHInput ? WETH_ADDRESS : step.tokenIn;
      const tokenOut = step.tokenOut === 'ETH' ? WETH_ADDRESS : step.tokenOut;
      
      transactionData = {
        amountIn: amountIn,
        amountOutMin: amountOutMinimum,
        path: [tokenIn, tokenOut],
        to: walletAddress,
        deadline: deadline,
      };
      // For V2 ETH swaps, value should be the ETH amount
      value = isETHInput ? amountIn : 0n;
      console.log("🔍 V2 value calculation:", {
        stepTokenIn: step.tokenIn,
        isETHInput,
        amountIn: amountIn.toString(),
        value: value.toString()
      });
    } else {
      // V3-style DEXs (Baseswap, etc.)
      transactionData = {
        tokenIn: step.tokenIn,
        tokenOut: step.tokenOut,
        amountIn: amountIn,
        amountOutMin: amountOutMinimum,
        to: walletAddress,
        deadline: deadline,
      };
      value = isETHInput ? amountIn : 0n;
    }

    console.log("📋 Transaction data:", {
      ...transactionData,
      value: value.toString()
    });
    
    // Debug path construction
    if (transactionData.path) {
      console.log("🔍 Path construction debug:", {
        method: routerConfig.method,
        path: transactionData.path,
        pathType: typeof transactionData.path,
        pathIsArray: Array.isArray(transactionData.path),
        pathLength: transactionData.path.length,
        tokenIn: transactionData.path[0],
        tokenOut: transactionData.path[1]
      });
    }

    // Encode the transaction data for the frontend
    let encodedData = "0x";
    try {
      // Create router interface for encoding
      const routerInterface = new ethers.Interface([
        // Uniswap V2 functions
        "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
        "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable",
        "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external",
        "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
        "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external",
        // V3-style functions (Aerodrome, Baseswap, etc.)
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external payable returns (uint256 amountOut)",
        // Uniswap V3 functions
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
      ]);

      if (routerConfig.method === "swapExactETHForTokens") {
        encodedData = routerInterface.encodeFunctionData("swapExactETHForTokens", [
          transactionData.amountOutMin,
          transactionData.path,
          transactionData.to,
          transactionData.deadline
        ]);
      } else if (routerConfig.method === "swapExactTokensForETH") {
        encodedData = routerInterface.encodeFunctionData("swapExactTokensForETH", [
          transactionData.amountIn,
          transactionData.amountOutMin,
          transactionData.path,
          transactionData.to,
          transactionData.deadline
        ]);
      } else if (routerConfig.method === "swapExactTokensForTokens") {
        encodedData = routerInterface.encodeFunctionData("swapExactTokensForTokens", [
          transactionData.amountIn,
          transactionData.amountOutMin,
          transactionData.path,
          transactionData.to,
          transactionData.deadline
        ]);
      } else if (routerConfig.method === "swap") {
        encodedData = routerInterface.encodeFunctionData("swap", [
          transactionData.tokenIn,
          transactionData.tokenOut,
          transactionData.amountIn,
          transactionData.amountOutMin,
          transactionData.to,
          transactionData.deadline
        ]);
      } else if (routerConfig.method === "exactInputSingle") {
        // For Uniswap V3 - encode the struct properly
        encodedData = routerInterface.encodeFunctionData("exactInputSingle", [{
          tokenIn: transactionData.tokenIn,
          tokenOut: transactionData.tokenOut,
          fee: transactionData.fee,
          recipient: transactionData.recipient,
          deadline: transactionData.deadline,
          amountIn: transactionData.amountIn.toString(),
          amountOutMinimum: transactionData.amountOutMinimum.toString(),
          sqrtPriceLimitX96: transactionData.sqrtPriceLimitX96
        }]);
      }

      console.log("✅ Transaction data encoded successfully:", {
        method: routerConfig.method,
        encodedData: encodedData.substring(0, 66) + "...",
        dataLength: encodedData.length,
        fullEncodedData: encodedData // 🔧 DEBUG: Log full encoded data
      });
      
      // 🔧 CRITICAL: Validate encoded data
      if (!encodedData || encodedData === "0x" || encodedData.length < 10) {
        console.error("❌ CRITICAL: Encoded data is empty or invalid:", {
          encodedData: encodedData,
          encodedDataLength: encodedData ? encodedData.length : 0,
          method: routerConfig.method,
          transactionData: transactionData
        });
        throw new Error("Transaction encoding failed - encoded data is empty");
      }
    } catch (encodeError) {
      console.error("❌ Transaction data encoding failed:", encodeError);
      throw new Error(`Failed to encode transaction data: ${encodeError instanceof Error ? encodeError.message : 'Unknown error'}`);
    }

    // Gas estimation
    let gasEstimate = route.gasEstimate;
    
    // Add 20% buffer to gas estimate
    gasEstimate = (gasEstimate * 120n) / 100n;

    // Get current gas price
    let feeData;
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      feeData = await provider.getFeeData();
    } catch (gasError) {
      console.error("❌ Gas price fetch error:", gasError);
      // Use fallback gas prices
      feeData = {
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 100000000n,
        gasPrice: 1000000000n
      };
    }
    
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 100000000n;

    // Create the actual transaction data for the frontend
    const transactionDataForFrontend = {
      to: routerAddress,
      data: encodedData, // Use the encoded data
      value: value.toString(),
      gasLimit: gasEstimate.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      nonce: "0" // Frontend will get the actual nonce
    };
    
    // 🔧 CRITICAL: Validate transaction data before sending to frontend
    console.log("🔍 Final transaction data validation:", {
      to: transactionDataForFrontend.to,
      data: transactionDataForFrontend.data ? transactionDataForFrontend.data.substring(0, 66) + "..." : "No data",
      dataLength: transactionDataForFrontend.data ? transactionDataForFrontend.data.length : 0,
      hasData: !!transactionDataForFrontend.data && transactionDataForFrontend.data !== "0x",
      method: routerConfig.method,
      encodedDataLength: encodedData.length
    });
    
    if (!transactionDataForFrontend.data || transactionDataForFrontend.data === "0x" || transactionDataForFrontend.data.length < 10) {
      console.error("❌ CRITICAL: Transaction data is empty before sending to frontend!");
      throw new Error("Transaction encoding failed - empty data");
    }

    console.log("📋 Transaction data for frontend:", transactionDataForFrontend);
    console.log("⛽ Gas estimation:", {
      gasEstimate: gasEstimate.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    });

    console.log("📋 Final prepare response data:", {
      router: routerAddress,
      method: routerConfig.method,
      params: routerConfig.method === 'exactInputSingle' ? {
        tokenIn: transactionData.tokenIn,
        tokenOut: transactionData.tokenOut,
        fee: transactionData.fee,
        recipient: transactionData.recipient,
        deadline: transactionData.deadline,
        amountIn: transactionData.amountIn.toString(),
        amountOutMinimum: transactionData.amountOutMinimum.toString(),
        sqrtPriceLimitX96: transactionData.sqrtPriceLimitX96
      } : routerConfig.method === 'swapExactETHForTokens' ? {
        amountOutMin: transactionData.amountOutMin.toString(),
        path: transactionData.path,
        to: transactionData.to,
        deadline: transactionData.deadline
      } : routerConfig.method === 'swapExactTokensForETH' ? {
        amountIn: transactionData.amountIn.toString(),
        amountOutMin: transactionData.amountOutMin.toString(),
        path: transactionData.path,
        to: transactionData.to,
        deadline: transactionData.deadline
      } : routerConfig.method === 'swapExactTokensForTokens' ? {
        amountIn: transactionData.amountIn.toString(),
        amountOutMin: transactionData.amountOutMin.toString(),
        path: transactionData.path,
        to: transactionData.to,
        deadline: transactionData.deadline
      } : {
        tokenIn: transactionData.tokenIn,
        tokenOut: transactionData.tokenOut,
        amountIn: transactionData.amountIn.toString(),
        amountOutMin: transactionData.amountOutMin.toString(),
        to: transactionData.to,
        deadline: transactionData.deadline
      }
    });
    
    return NextResponse.json({
      success: true,
      transactionData: transactionDataForFrontend,
      data: {
        router: routerAddress,
        method: routerConfig.method,
        params: routerConfig.method === 'exactInputSingle' ? {
          tokenIn: transactionData.tokenIn,
          tokenOut: transactionData.tokenOut,
          fee: transactionData.fee,
          recipient: transactionData.recipient,
          deadline: transactionData.deadline,
          amountIn: transactionData.amountIn.toString(),
          amountOutMinimum: transactionData.amountOutMinimum.toString(),
          sqrtPriceLimitX96: transactionData.sqrtPriceLimitX96
        } : routerConfig.method === 'swapExactETHForTokens' ? {
          amountOutMin: transactionData.amountOutMin.toString(),
          path: transactionData.path,
          to: transactionData.to,
          deadline: transactionData.deadline
        } : routerConfig.method === 'swapExactTokensForETH' ? {
          amountIn: transactionData.amountIn.toString(),
          amountOutMin: transactionData.amountOutMin.toString(),
          path: transactionData.path,
          to: transactionData.to,
          deadline: transactionData.deadline
        } : routerConfig.method === 'swapExactTokensForTokens' ? {
          amountIn: transactionData.amountIn.toString(),
          amountOutMin: transactionData.amountOutMin.toString(),
          path: transactionData.path,
          to: transactionData.to,
          deadline: transactionData.deadline
        } : {
          tokenIn: transactionData.tokenIn,
          tokenOut: transactionData.tokenOut,
          amountIn: transactionData.amountIn.toString(),
          amountOutMin: transactionData.amountOutMin.toString(),
          to: transactionData.to,
          deadline: transactionData.deadline
        },
        value: value.toString(),
        gasEstimate: gasEstimate.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        deadline: deadline,
        route: {
          steps: route.steps.length,
          isMultiHop: false,
          totalAmountOut: route.totalAmountOut.toString(),
          amountOutMinimum: amountOutMinimum.toString(),
          dexId: poolValidation.dexId,
          version: poolValidation.version,
          poolAddress: poolValidation.poolAddress,
          fee: poolValidation.fee
        }
      }
    });

  } catch (error) {
    console.error("❌ Prepare swap error:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: "PREPARE_FAILED",
      message: errorMessage,
      details: {
        title: "Swap Preparation Failed",
        suggestion: "Please check the token addresses and try again."
      }
    }, { status: 500 });
  }
}


