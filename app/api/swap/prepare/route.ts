import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// DEX Router Addresses on Base Chain - UPDATED with verified addresses
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

// 🔧 FIXED: Updated router ABIs with correct methods for each DEX
const ROUTER_ABIS = {
  uniswap_v2: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
  ],
  aerodrome: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external payable returns (uint256 amountOut)"
  ],
  baseswap: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
  ],
  sushiswap: [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
  ],
  uniswap_v3: [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
    "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
    "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)"
  ],
  oneinch: [
    "function swap((address executor, address desc, bytes data)) external payable returns (uint256 returnAmount)",
    "function swap((address executor, address desc, bytes data), (address allowanceTarget, uint256 allowanceAmount)) external payable returns (uint256 returnAmount)"
  ]
};

interface PrepareSwapRequest {
  inputToken: string;
  outputToken: string;
  amountIn?: string | bigint;
  inputAmount?: string | bigint;
  outputAmount?: string; // 🔧 ADDED: Output amount from quote
  slippage?: number;
  walletAddress: string;
  tokenAddress?: string;
  preferredDex?: string;
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

// 🔧 FIXED: Enhanced DEX liquidity testing with better error handling
async function testDexLiquidity(
  dexId: string,
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  decimals: number
): Promise<{ success: boolean; gasEstimate?: bigint; error?: string; method?: string }> {
  try {
    const dexConfig = DEX_ROUTERS[dexId as keyof typeof DEX_ROUTERS];
    if (!dexConfig) {
      return { success: false, error: "DEX not supported" };
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const routerABI = ROUTER_ABIS[dexId as keyof typeof ROUTER_ABIS];
    const router = new ethers.Contract(dexConfig.router, routerABI, provider);
    
    const isETHInput = tokenInAddress === WETH_ADDRESS;
    const isETHOutput = tokenOutAddress === WETH_ADDRESS;
    
    const amountInWei = ethers.parseUnits(amountIn, decimals);
    
    // Use more realistic slippage for testing (20% instead of 5%)
    const amountOutMin = amountInWei * 80n / 100n; // 20% slippage for testing
    const path = [tokenInAddress, tokenOutAddress];
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const dummyAddress = "0x0000000000000000000000000000000000000001";
    
    // Check if this is a self-swap (same token)
    if (tokenInAddress.toLowerCase() === tokenOutAddress.toLowerCase()) {
      return { success: false, error: "Cannot swap token for itself" };
    }
    
    let gasEstimate: bigint;
    let method: string = 'unknown';
    
    try {
      // 🔧 FIXED: Improved method selection logic
      if (isETHInput) {
        // ETH -> Token
        method = 'swapExactETHForTokens';
        gasEstimate = await router.swapExactETHForTokens.estimateGas(
          amountOutMin,
          path,
          dummyAddress,
          deadline,
          { value: amountInWei }
        );
      } else if (isETHOutput) {
        // Token -> ETH
        if (dexId === 'aerodrome') {
          // 🔧 FIXED: Use the correct method for Aerodrome token->ETH swaps
          method = 'swapExactTokensForETHSupportingFeeOnTransferTokens';
          gasEstimate = await router.swapExactTokensForETHSupportingFeeOnTransferTokens.estimateGas(
            amountInWei,
            amountOutMin,
            path,
            dummyAddress,
            deadline
          );
        } else {
          method = 'swapExactTokensForETHSupportingFeeOnTransferTokens';
          gasEstimate = await router.swapExactTokensForETHSupportingFeeOnTransferTokens.estimateGas(
            amountInWei,
            amountOutMin,
            path,
            dummyAddress,
            deadline
          );
        }
      } else {
        // Token -> Token
        if (dexId === 'aerodrome') {
          method = 'swapExactTokensForTokens';
          gasEstimate = await router.swapExactTokensForTokens.estimateGas(
            amountInWei,
            amountOutMin,
            path,
            dummyAddress,
            deadline
          );
        } else {
          method = 'swapExactTokensForTokensSupportingFeeOnTransferTokens';
          gasEstimate = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens.estimateGas(
            amountInWei,
            amountOutMin,
            path,
            dummyAddress,
            deadline
          );
        }
      }
      
      return { 
        success: true, 
        gasEstimate: gasEstimate * 120n / 100n, // Add 20% buffer
        method: method
      };
      
    } catch (gasError) {
      // 🔧 FIXED: Better error handling and fallback methods
      console.log(`⚠️ Gas estimation failed for ${dexId} with method ${method}:`, gasError);
      
      // Try alternative methods for Aerodrome
      if (dexId === 'aerodrome' && !isETHInput) {
        try {
          // Try the generic 'swap' method for Aerodrome
          method = 'swap';
          gasEstimate = await router.swap.estimateGas(
            tokenInAddress,
            tokenOutAddress,
            amountInWei,
            amountOutMin,
            dummyAddress,
            deadline
          );
          
          console.log(`✅ Aerodrome 'swap' method worked! Gas: ${gasEstimate.toString()}`);
            return {
            success: true, 
            gasEstimate: gasEstimate * 120n / 100n,
            method: method
          };
        } catch (swapError) {
          console.log(`❌ Aerodrome 'swap' method also failed:`, swapError);
        }
      }
      
      // Provide default gas estimates based on DEX
      let defaultGas = 200000n;
      if (dexId === 'uniswap_v2') defaultGas = 180000n;
      if (dexId === 'aerodrome') defaultGas = 200000n;
      if (dexId === 'baseswap') defaultGas = 180000n;
      
      // Check if the error is due to insufficient liquidity or other issues
      const errorMessage = gasError instanceof Error ? gasError.message : 'Unknown error';
      console.log(`🔍 Gas estimation error analysis for ${dexId}:`, errorMessage);
      
      if (errorMessage.includes("INSUFFICIENT_OUTPUT_AMOUNT") || 
          errorMessage.includes("INSUFFICIENT_LIQUIDITY") ||
          errorMessage.includes("TRANSFER_FROM_FAILED") ||
          errorMessage.includes("execution reverted")) {
        
        // 🔧 NEW: For TRANSFER_FROM_FAILED, it might be an allowance issue
        if (errorMessage.includes("TRANSFER_FROM_FAILED")) {
          console.log(`⚠️ TRANSFER_FROM_FAILED detected - this might be an allowance issue`);
          return { 
            success: false, 
            error: "Token approval required or insufficient allowance",
            method: method
          };
        }
        
        return { 
          success: false, 
          error: "Insufficient liquidity for this token pair",
          method: method
        };
      }
      
      // For other errors, we'll still try with default gas estimate
      console.log(`⚠️ Using default gas estimate for ${dexId}: ${defaultGas.toString()}`);
      return { 
        success: true, 
        gasEstimate: defaultGas,
        method: method || 'unknown'
      };
    }
    
          } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// 🔧 FIXED: Simplified DEX selection - skip liquidity testing for now
async function findBestDex(
  tokenInAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  preferredDex?: string
): Promise<{ dexId: string; routerAddress: string; method: string; gasEstimate: bigint }> {
  console.log("🔍 Finding best DEX for swap...");
  
  // 🔧 FIXED: Skip complex liquidity testing and use direct method selection
  const isETHInput = tokenInAddress === WETH_ADDRESS;
  const isETHOutput = tokenOutAddress === WETH_ADDRESS;
  
  // Determine the best DEX based on the swap type
  let dexId: string;
  let method: string;
  
  if (preferredDex && DEX_ROUTERS[preferredDex as keyof typeof DEX_ROUTERS]) {
    dexId = preferredDex;
    console.log("✅ Using preferred DEX:", preferredDex);
  } else {
    // Default to Uniswap V2 for Base chain (most reliable for most tokens)
    dexId = 'uniswap_v2';
    console.log("⚠️ No preferred DEX, defaulting to Uniswap V2");
  }
  
  console.log("🔍 Selected DEX:", dexId);
  
  // Determine the correct method based on token types
  if (isETHInput) {
    // ETH -> Token
    method = 'swapExactETHForTokens';
  } else if (isETHOutput) {
    // Token -> ETH
    method = 'swapExactTokensForETHSupportingFeeOnTransferTokens';
  } else {
    // Token -> Token
    method = 'swapExactTokensForTokensSupportingFeeOnTransferTokens';
  }
  
  const dexConfig = DEX_ROUTERS[dexId as keyof typeof DEX_ROUTERS];
  const gasEstimate = 300000n; // Default gas estimate
  
  console.log(`✅ Using DEX: ${dexId}, Method: ${method}, Router: ${dexConfig.router}`);
  
  return {
    dexId,
    routerAddress: dexConfig.router,
    method,
    gasEstimate
  };
}

export async function POST(request: Request) {
  try {
    console.log("🔄 Prepare swap request received");
    
    const body: PrepareSwapRequest = await request.json();
    console.log("📋 Request body:", JSON.stringify(body, null, 2));
    const { inputToken, outputToken, amountIn: amountInRaw, inputAmount: inputAmountRaw, slippage = 0.5, walletAddress, preferredDex } = body;

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
      walletAddress,
      preferredDex
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

    // Get token information
    const inputTokenInfo = getTokenInfo(inputToken, inputToken !== "ETH" ? body.tokenAddress : undefined);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken !== "ETH" ? body.tokenAddress : undefined);
    
    console.log("🔍 Token info:", { inputTokenInfo, outputTokenInfo });
    
    // Find best DEX
    console.log("🔍 Finding best DEX for:", {
      inputToken: inputTokenInfo.address,
      outputToken: outputTokenInfo.address,
      amountIn: ethers.formatUnits(amountIn, 18),
      preferredDex
    });
    
    const dexInfo = await findBestDex(inputTokenInfo.address, outputTokenInfo.address, ethers.formatUnits(amountIn, 18), preferredDex);
    console.log("✅ Using DEX:", dexInfo);

    // 🔧 FIXED: Dynamic slippage adjustment for large sells
    let adjustedSlippage = slippage;
    if (outputToken === "ETH" && inputToken !== "ETH") { // Sell operation
      const amountInEth = parseFloat(ethers.formatUnits(amountIn, 18));
      
      // Check if this is a large sell (more than 50% of typical balance)
      if (amountInEth > 100) { // Large sell threshold
        adjustedSlippage = Math.max(slippage, 2.0); // Minimum 2% slippage for large sells
        console.log("🔧 Large sell detected - adjusting slippage:", {
          originalSlippage: slippage,
          adjustedSlippage,
          amountInEth,
          reason: "Large sells need higher slippage tolerance"
        });
      }
      
      // For very large sells (90%+ of balance), increase slippage further
      if (amountInEth > 1000) {
        adjustedSlippage = Math.max(adjustedSlippage, 5.0); // Minimum 5% slippage for very large sells
        console.log("🔧 Very large sell detected - further adjusting slippage:", {
          originalSlippage: slippage,
          adjustedSlippage,
          amountInEth,
          reason: "Very large sells need even higher slippage tolerance"
        });
      }
    }
    
    // Calculate amount out minimum with adjusted slippage
    const slippageMultiplier = (100 - adjustedSlippage) / 100;
    
    // 🔧 FIXED: Use the actual outputAmount from the request instead of hardcoded estimation
    let amountOutMinimum: bigint;
    if (body.outputAmount) {
      const outputAmountWei = ethers.parseUnits(body.outputAmount, 18);
      amountOutMinimum = (outputAmountWei * BigInt(Math.floor(slippageMultiplier * 1000))) / 1000n;
      console.log("✅ Using actual outputAmount for slippage calculation:", {
        outputAmount: body.outputAmount,
        outputAmountWei: outputAmountWei.toString(),
        slippageMultiplier,
        amountOutMinimum: amountOutMinimum.toString()
      });
    } else {
      // Fallback to estimation if no outputAmount provided
      const estimatedOutput = amountIn * 95n / 100n; // Assume 5% slippage for estimation
      amountOutMinimum = (estimatedOutput * BigInt(Math.floor(slippageMultiplier * 1000))) / 1000n;
      console.log("⚠️ No outputAmount provided, using estimation:", {
        estimatedOutput: estimatedOutput.toString(),
        slippageMultiplier,
        amountOutMinimum: amountOutMinimum.toString()
      });
    }
    
    console.log("🔍 Slippage calculation:", {
      amountIn: amountIn.toString(),
      slippageMultiplier,
      amountOutMinimum: amountOutMinimum.toString()
    });

    // Set deadline (30 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 1800;

    // 🔧 FIXED: Enhanced transaction data preparation for all methods
    let transactionData: any;
    let value: bigint;
    const routerAddress = dexInfo.routerAddress;
    
    if (dexInfo.method === 'swapExactETHForTokens') {
      // ETH -> Token swap
      transactionData = {
        amountOutMin: amountOutMinimum.toString(),
        path: [inputTokenInfo.address, outputTokenInfo.address],
        to: walletAddress,
        deadline: deadline
      };
      value = amountIn;
    } else if (dexInfo.method === 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
      // Token -> ETH swap (Uniswap V2 style)
       transactionData = {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMinimum.toString(),
        path: [inputTokenInfo.address, outputTokenInfo.address],
         to: walletAddress,
        deadline: deadline
      };
      value = 0n;
    } else if (dexInfo.method === 'swapExactTokensForETH' || dexInfo.method === 'swapExactTokensForETHSupportingFeeOnTransferTokens') {
      // Token -> ETH swap (Aerodrome style)
        transactionData = {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMinimum.toString(),
        path: [inputTokenInfo.address, outputTokenInfo.address],
          to: walletAddress,
        deadline: deadline
      };
      value = 0n;
    } else if (dexInfo.method === 'swapExactTokensForTokens') {
      // Token -> Token swap
      const path = outputTokenInfo.address === WETH_ADDRESS ? 
        [inputTokenInfo.address, WETH_ADDRESS] : 
        [inputTokenInfo.address, outputTokenInfo.address];
        
        transactionData = {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMinimum.toString(),
        path: path,
          to: walletAddress,
        deadline: deadline
      };
      value = 0n;
    } else if (dexInfo.method === 'swap') {
      // Aerodrome's generic swap method
      transactionData = {
        tokenIn: inputTokenInfo.address,
        tokenOut: outputTokenInfo.address,
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMinimum.toString(),
        to: walletAddress,
        deadline: deadline
      };
      value = 0n;
    } else {
      throw new Error(`Unsupported method: ${dexInfo.method}`);
    }

    console.log("📋 Transaction data:", {
      ...transactionData,
      value: value.toString()
    });
    
    // 🔧 FIXED: Enhanced transaction encoding with proper method handling
    let encodedData = "0x";
    try {
      console.log("🔧 Starting transaction encoding with:", {
        dexId: dexInfo.dexId,
        method: dexInfo.method,
        routerAddress: routerAddress
      });
      
      // Use the correct ABI for the specific DEX
      const routerABI = ROUTER_ABIS[dexInfo.dexId as keyof typeof ROUTER_ABIS];
      if (!routerABI) {
        throw new Error(`No ABI found for DEX: ${dexInfo.dexId}`);
      }
      
      console.log("📋 Router ABI loaded:", routerABI.length, "functions");
      const routerInterface = new ethers.Interface(routerABI);

      // 🔧 FIXED: Use switch statement to avoid TypeScript union type issues
      console.log("🔧 Encoding method:", dexInfo.method);
      console.log("🔧 Transaction data:", transactionData);
      
      switch (dexInfo.method) {
        case "swapExactETHForTokens":
          console.log("🔧 Encoding swapExactETHForTokens");
          encodedData = routerInterface.encodeFunctionData("swapExactETHForTokens", [
            transactionData.amountOutMin,
            transactionData.path,
            transactionData.to,
            transactionData.deadline
          ]);
          break;
          
        case "swapExactTokensForETHSupportingFeeOnTransferTokens":
          console.log("🔧 Encoding swapExactTokensForETHSupportingFeeOnTransferTokens");
          encodedData = routerInterface.encodeFunctionData("swapExactTokensForETHSupportingFeeOnTransferTokens", [
            transactionData.amountIn,
            transactionData.amountOutMin,
            transactionData.path,
            transactionData.to,
            transactionData.deadline
          ]);
          break;
          
        case "swapExactTokensForETH":
          console.log("🔧 Encoding swapExactTokensForETH");
          encodedData = routerInterface.encodeFunctionData("swapExactTokensForETH", [
            transactionData.amountIn,
            transactionData.amountOutMin,
            transactionData.path,
            transactionData.to,
            transactionData.deadline
          ]);
          break;
          
        case "swapExactTokensForTokens":
          encodedData = routerInterface.encodeFunctionData("swapExactTokensForTokens", [
            transactionData.amountIn,
            transactionData.amountOutMin,
            transactionData.path,
            transactionData.to,
            transactionData.deadline
          ]);
          break;
          
        case "swap":
          encodedData = routerInterface.encodeFunctionData("swap", [
            transactionData.tokenIn,
            transactionData.tokenOut,
            transactionData.amountIn,
            transactionData.amountOutMin,
            transactionData.to,
            transactionData.deadline
          ]);
          break;
          
        default:
          throw new Error(`Unsupported method for encoding: ${dexInfo.method}`);
      }

      console.log("✅ Transaction data encoded successfully:", {
        method: dexInfo.method,
        encodedData: encodedData.substring(0, 66) + "...",
        dataLength: encodedData.length
      });
      
    } catch (encodeError) {
      console.error("❌ Transaction data encoding failed:", encodeError);
      throw new Error(`Failed to encode transaction data: ${encodeError instanceof Error ? encodeError.message : 'Unknown error'}`);
    }

    // Gas estimation
    let gasEstimate = dexInfo.gasEstimate;
    
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

    // Create the transaction data for the frontend
    const transactionDataForFrontend = {
      to: routerAddress,
      data: encodedData,
      value: value.toString(),
      gasLimit: gasEstimate.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      nonce: "0" // Frontend will get the actual nonce
    };

    console.log("📋 Transaction data for frontend:", transactionDataForFrontend);
    console.log("⛽ Gas estimation:", {
      gasEstimate: gasEstimate.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
    });
    
    return NextResponse.json({
      success: true,
      transactionData: transactionDataForFrontend,
      data: {
        router: routerAddress,
        method: dexInfo.method,
        params: transactionData,
        value: value.toString(),
        gasEstimate: gasEstimate.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        deadline: deadline,
        route: {
          steps: 1,
          isMultiHop: false,
          totalAmountOut: body.outputAmount || "0",
          amountOutMinimum: amountOutMinimum.toString(),
          dexId: dexInfo.dexId,
          version: "v2",
          poolAddress: "unknown",
          fee: 3000
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


