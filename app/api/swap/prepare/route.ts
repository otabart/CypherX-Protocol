import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

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
  
  return {
    maxFeePerGas: feeData.maxFeePerGas || feeData.gasPrice || 20000000000n, // 20 gwei fallback
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 1500000000n // 1.5 gwei
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
    
    // Convert amounts to wei
    const amountInWei = ethers.parseUnits(inputAmount, inputTokenInfo.decimals);
    const amountOutWei = ethers.parseUnits(outputAmount, outputTokenInfo.decimals);
    
    // Calculate minimum amount out with slippage (more conservative)
    const slippageMultiplier = (100 - slippage) / 100;
    const amountOutMinimum = (amountOutWei * BigInt(Math.floor(slippageMultiplier * 10000))) / 10000n;
    
    // Ensure minimum amount is not zero
    if (amountOutMinimum <= 0n) {
      throw new Error("Calculated minimum output amount is zero or negative");
    }
    
    console.log("📊 Slippage calculation:", {
      slippage,
      slippageMultiplier,
      amountOutWei: amountOutWei.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      difference: (amountOutWei - amountOutMinimum).toString(),
      amountOutWeiFormatted: ethers.formatUnits(amountOutWei, outputTokenInfo.decimals),
      amountOutMinimumFormatted: ethers.formatUnits(amountOutMinimum, outputTokenInfo.decimals)
    });
    
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
      amountIn: swapParams.amountIn.toString(),
      amountOutMinimum: swapParams.amountOutMinimum.toString()
    });
    
    // Use more conservative gas estimates to avoid failures
    let gasEstimate;
    if (inputTokenInfo.address === WETH_ADDRESS) {
      gasEstimate = 500000n; // 500k gas for ETH swaps (increased from 350k)
    } else {
      gasEstimate = 400000n; // 400k gas for token swaps (increased from 250k)
    }
    
    console.log(`📊 Using gas estimate: ${gasEstimate.toString()}`);
    
    // Get gas price and nonce
    const gasPrice = await getGasPrice();
    const nonce = await provider.getTransactionCount(walletAddress, "pending");
    
    // Encode the transaction data
    const swapData = router.interface.encodeFunctionData("exactInputSingle", [swapParams]);
    console.log("📝 Encoded swap data:", swapData);
    
    // Validate that we have proper transaction data
    if (!swapData || swapData === "0x") {
      throw new Error("Failed to encode swap transaction data");
    }
    
    // Build transaction object with proper EIP-1559 format
    const transactionData = {
      to: UNISWAP_V3_ROUTER,
      data: swapData,
      nonce: nonce,
      gasLimit: gasEstimate.toString(),
      maxFeePerGas: gasPrice.maxFeePerGas.toString(),
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas.toString(),
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
