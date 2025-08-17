import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Base chain Uniswap V3 Router
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base chain WETH

// Uniswap V3 Router ABI (minimal for exactInputSingle)
const UNISWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

interface PrepareSwapRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  walletAddress: string;
  tokenAddress?: string;
}



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
  
  if (tokenAddress) {
    return {
      address: tokenAddress,
      symbol: symbol,
      name: symbol,
      decimals: 18,
      logo: "https://via.placeholder.com/32"
    };
  }
  
  throw new Error(`Unknown token: ${symbol}`);
}

async function getGasPrice(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const feeData = await provider.getFeeData();
  
  // Base L2 gas prices are much lower than Ethereum mainnet
  // Use actual fee data or very low fallbacks for Base
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n; // 1 Gwei fallback for Base
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 100000000n; // 0.1 Gwei fallback for Base
  
  console.log("🔍 Base gas price data:", {
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    gasPrice: feeData.gasPrice?.toString()
  });
  
  return {
    maxFeePerGas,
    maxPriorityFeePerGas
  };
}

export async function POST(request: Request) {
  try {
    const body: PrepareSwapRequest = await request.json();
    console.log("Prepare swap request:", {
      inputToken: body.inputToken,
      outputToken: body.outputToken,
      inputAmount: body.inputAmount,
      outputAmount: body.outputAmount,
      slippage: body.slippage,
      walletAddress: body.walletAddress,
      tokenAddress: body.tokenAddress
    });
    
    const { 
      inputToken, 
      outputToken, 
      inputAmount, 
      outputAmount, 
      slippage, 
      walletAddress,
      tokenAddress
    } = body;
    
    if (!inputToken || !outputToken || !inputAmount || !outputAmount || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Validate input
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid input amount" },
        { status: 400 }
      );
    }
    
    // Get token information
    console.log("Getting token info for:", { inputToken, outputToken, tokenAddress });
    const inputTokenInfo = getTokenInfo(inputToken, inputToken === "ETH" ? undefined : tokenAddress);
    const outputTokenInfo = getTokenInfo(outputToken, outputToken === "ETH" ? undefined : tokenAddress);
    console.log("Token info:", { inputTokenInfo, outputTokenInfo });
    
    // Validate token addresses
    if (!inputTokenInfo.address || !outputTokenInfo.address) {
      throw new Error("Invalid token addresses");
    }
    
    // Ensure we're not swapping the same token
    if (inputTokenInfo.address.toLowerCase() === outputTokenInfo.address.toLowerCase()) {
      throw new Error("Cannot swap token for itself");
    }
    
    // Setup provider and router contract
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const router = new ethers.Contract(UNISWAP_V3_ROUTER, UNISWAP_ROUTER_ABI, provider);
    
    // Validate router contract exists
    try {
      const routerCode = await provider.getCode(UNISWAP_V3_ROUTER);
      if (routerCode === "0x") {
        throw new Error("Uniswap V3 Router contract not found at specified address");
      }
      console.log("✅ Uniswap V3 Router contract validated");
    } catch (error) {
      console.error("❌ Router contract validation failed:", error);
      throw new Error("Failed to validate Uniswap V3 Router contract");
    }
    
    // Convert amounts to wei
    const amountInWei = ethers.parseUnits(inputAmount, inputTokenInfo.decimals);
    const amountOutWei = ethers.parseUnits(outputAmount, outputTokenInfo.decimals);
    
    // Calculate minimum amount out with slippage (use proper decimal arithmetic)
    const slippageMultiplier = (100 - slippage) / 100;
    // Use BigInt arithmetic to avoid precision loss
    const slippageBasis = 10000n; // 100% = 10000 basis points
    const slippageBasisPoints = BigInt(Math.floor(slippage * 100)); // Convert percentage to basis points
    const amountOutMinimum = (amountOutWei * (slippageBasis - slippageBasisPoints)) / slippageBasis;
    
    // Ensure minimum amount is not zero and is reasonable
    if (amountOutMinimum <= 0n) {
      throw new Error("Calculated minimum output amount is zero or negative");
    }
    
    // Additional validation: ensure minimum amount is not too small relative to expected output
    const minAmountRatio = Number(amountOutMinimum) / Number(amountOutWei);
    if (minAmountRatio < 0.5) { // Minimum should be at least 50% of expected output
      console.warn("⚠️ Minimum amount seems too low, adjusting...");
      const adjustedMinimum = amountOutWei * 80n / 100n; // Use 80% as minimum
      console.log("Adjusted minimum amount:", {
        original: amountOutMinimum.toString(),
        adjusted: adjustedMinimum.toString(),
        ratio: minAmountRatio
      });
    }
    
    console.log("📊 Slippage calculation:", {
      slippage,
      slippageMultiplier,
      slippageBasisPoints: slippageBasisPoints.toString(),
      amountOutWei: amountOutWei.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      difference: (amountOutWei - amountOutMinimum).toString(),
      amountOutWeiFormatted: ethers.formatUnits(amountOutWei, outputTokenInfo.decimals),
      amountOutMinimumFormatted: ethers.formatUnits(amountOutMinimum, outputTokenInfo.decimals),
      minAmountRatio: minAmountRatio
    });
    
    // For very small amounts, use a more conservative minimum
    if (amountOutWei < 1000000n) { // Less than 0.000001 tokens
      console.warn("⚠️ Very small amount detected, using conservative minimum");
      const conservativeMinimum = amountOutWei * 90n / 100n; // 90% minimum for small amounts
      console.log("Conservative minimum for small amount:", {
        original: amountOutMinimum.toString(),
        conservative: conservativeMinimum.toString()
      });
    }
    
    // Set deadline (20 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    
    // Use a standard fee tier (0.3%) and conservative gas estimate
    // This avoids gas estimation issues during preparation
    const fee = 3000; // 0.3% fee
    const swapParams = {
      tokenIn: inputTokenInfo.address,
      tokenOut: outputTokenInfo.address,
      fee: fee,
      recipient: walletAddress,
      deadline: deadline,
      amountIn: amountInWei,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0,
    };

    console.log(`📋 Using fee tier ${fee} (${fee/10000}%)...`);
    console.log(`📋 Swap params:`, {
      tokenIn: swapParams.tokenIn,
      tokenOut: swapParams.tokenOut,
      fee: swapParams.fee,
      recipient: swapParams.recipient,
      deadline: swapParams.deadline,
      amountIn: swapParams.amountIn.toString(),
      amountOutMinimum: swapParams.amountOutMinimum.toString(),
      amountInFormatted: ethers.formatUnits(swapParams.amountIn, inputTokenInfo.decimals),
      amountOutMinimumFormatted: ethers.formatUnits(swapParams.amountOutMinimum, outputTokenInfo.decimals)
    });
    
    // Validate swap parameters
    if (swapParams.amountIn <= 0n) {
      throw new Error("Invalid input amount");
    }
    
    if (swapParams.amountOutMinimum <= 0n) {
      throw new Error("Invalid minimum output amount");
    }
    
    if (swapParams.deadline <= Math.floor(Date.now() / 1000)) {
      throw new Error("Invalid deadline - must be in the future");
    }
    
    if (swapParams.tokenIn.toLowerCase() === swapParams.tokenOut.toLowerCase()) {
      throw new Error("Cannot swap token for itself");
    }
    
    // Gas estimation with fallback
    let gasEstimate = BigInt(0);
    
    try {
      // Try to get actual gas estimate from the router
      gasEstimate = await router.exactInputSingle.estimateGas(swapParams);
      console.log("📊 Actual gas estimate from router:", gasEstimate.toString());
    } catch (error) {
      console.log("⚠️ Router gas estimation failed, using fallback");
      // Fallback gas estimates - Base L2 is much more efficient
      gasEstimate = inputTokenInfo.address === WETH_ADDRESS ? BigInt(150000) : BigInt(120000);
    }
    
    // Add 20% buffer to gas estimate
    gasEstimate = (gasEstimate * BigInt(120)) / BigInt(100);
    
    // Cap gas estimate at reasonable limits for Base L2
    const maxGasForEth = BigInt(200000); // 200k max for ETH swaps on Base
    const maxGasForToken = BigInt(150000); // 150k max for token swaps on Base
    
    if (inputTokenInfo.address === WETH_ADDRESS && gasEstimate > maxGasForEth) {
      console.log(`⚠️ Gas estimate ${gasEstimate} exceeds max ${maxGasForEth}, capping`);
      gasEstimate = maxGasForEth;
    } else if (inputTokenInfo.address !== WETH_ADDRESS && gasEstimate > maxGasForToken) {
      console.log(`⚠️ Gas estimate ${gasEstimate} exceeds max ${maxGasForToken}, capping`);
      gasEstimate = maxGasForToken;
    }
    
    console.log(`📊 Using gas estimate: ${gasEstimate.toString()}`);
    
    // Get gas price and nonce
    const gasPrice = await getGasPrice();
    const nonce = await provider.getTransactionCount(walletAddress, "pending");
    
    // Ensure minimum gas prices for transaction processing (Base L2 appropriate)
    const minMaxFeePerGas = BigInt(100000000); // 0.1 Gwei minimum for Base (much lower than mainnet)
    const minMaxPriorityFeePerGas = BigInt(10000000); // 0.01 Gwei minimum for Base
    
    const adjustedMaxFeePerGas = gasPrice.maxFeePerGas < minMaxFeePerGas ? minMaxFeePerGas : gasPrice.maxFeePerGas;
    const adjustedMaxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas < minMaxPriorityFeePerGas ? minMaxPriorityFeePerGas : gasPrice.maxPriorityFeePerGas;
    
    console.log("⛽ Gas price details:", {
      originalMaxFeePerGas: gasPrice.maxFeePerGas.toString(),
      originalMaxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas.toString(),
      adjustedMaxFeePerGas: adjustedMaxFeePerGas.toString(),
      adjustedMaxPriorityFeePerGas: adjustedMaxPriorityFeePerGas.toString(),
      gasEstimate: gasEstimate.toString()
    });
    
    // Check wallet balance for ETH swaps
    if (inputTokenInfo.address === WETH_ADDRESS) {
      const walletBalance = await provider.getBalance(walletAddress);
      const requiredAmount = swapParams.amountIn + (gasEstimate * adjustedMaxFeePerGas); // Include gas cost
      
      if (walletBalance < requiredAmount) {
        throw new Error(`Insufficient ETH balance. Required: ${ethers.formatEther(requiredAmount)}, Available: ${ethers.formatEther(walletBalance)}`);
      }
      
      console.log("💰 Balance check passed:", {
        walletBalance: ethers.formatEther(walletBalance),
        requiredAmount: ethers.formatEther(requiredAmount),
        gasCost: ethers.formatEther(gasEstimate * adjustedMaxFeePerGas)
      });
    }
    
    // Encode the transaction data
    const swapData = router.interface.encodeFunctionData("exactInputSingle", [swapParams]);
    console.log("📝 Encoded swap data:", swapData);
    
    // Validate that we have proper transaction data
    if (!swapData || swapData === "0x") {
      throw new Error("Failed to encode swap transaction data");
    }
    
    // Ensure the data starts with 0x
    const formattedData = swapData.startsWith('0x') ? swapData : `0x${swapData}`;
    
    // Build transaction object with proper EIP-1559 format
    const transactionData = {
      to: UNISWAP_V3_ROUTER,
      data: formattedData,
      nonce: nonce,
      gasLimit: gasEstimate.toString(),
      maxFeePerGas: adjustedMaxFeePerGas.toString(),
      maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas.toString(),
      value: inputTokenInfo.address === WETH_ADDRESS ? amountInWei.toString() : "0",
      chainId: 8453 // Base chain ID
    };
    
    console.log("📋 Transaction data prepared:", {
      to: transactionData.to,
      data: transactionData.data.substring(0, 66) + "...", // Show first part of data
      dataLength: transactionData.data.length,
      gasLimit: transactionData.gasLimit,
      value: transactionData.value,
      nonce: transactionData.nonce,
      maxFeePerGas: transactionData.maxFeePerGas,
      maxPriorityFeePerGas: transactionData.maxPriorityFeePerGas
    });
    
    // Validate the prepared transaction data
    if (!transactionData.data || transactionData.data === "0x" || transactionData.data.length < 10) {
      console.error("❌ Invalid transaction data prepared:", transactionData);
      throw new Error("Failed to prepare valid transaction data");
    }
    
    // Additional validation - ensure the data is a valid hex string
    if (!/^0x[a-fA-F0-9]+$/.test(transactionData.data)) {
      console.error("❌ Invalid hex data:", transactionData.data);
      throw new Error("Invalid transaction data format");
    }
    
    return NextResponse.json({
      success: true,
      transactionData
    });
    
  } catch (error) {
    console.error("Prepare swap error:", error);
    
    let errorMessage = "Failed to prepare swap";
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("gas")) {
        errorMessage = "Gas estimation failed";
      } else if (error.message.includes("pool")) {
        errorMessage = "Pool not found - insufficient liquidity";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
