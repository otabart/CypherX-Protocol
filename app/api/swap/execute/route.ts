import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Constants
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Base chain Uniswap V3 Router
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

// Router ABI
const ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

interface SwapRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  walletAddress: string;
  privateKey: string;
  tokenAddress?: string; // Add token address for dynamic tokens
}

interface SwapResponse {
  success: boolean;
  transactionHash?: string;
  amountOut?: string;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
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

// Get ETH price for USD conversion
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

// Get token price
async function getTokenPrice(tokenAddress: string): Promise<number> {
  if (tokenAddress === ETH_ADDRESS) {
    return await getEthPrice();
  }

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    const pair = data.pairs?.[0];
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0;
  }
}

// Check wallet balance
async function checkBalance(
  provider: ethers.Provider,
  walletAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number
): Promise<boolean> {
  if (tokenAddress === WETH_ADDRESS) {
    // For WETH swaps, check ETH balance since we'll wrap it
    const balance = await provider.getBalance(walletAddress);
    const amountWei = ethers.parseUnits(amount, decimals);
    return balance >= amountWei;
  } else {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const amountWei = ethers.parseUnits(amount, decimals);
    return balance >= amountWei;
  }
}

// Check and approve token if needed
async function checkAndApproveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string,
  decimals: number
): Promise<void> {
  if (tokenAddress === WETH_ADDRESS) {
    return; // No approval needed for WETH (handled by router)
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const amountWei = ethers.parseUnits(amount, decimals);
  const currentAllowance = await tokenContract.allowance(await signer.getAddress(), UNISWAP_V3_ROUTER);

  if (currentAllowance < amountWei) {
    console.log("Approving token...");
    const approveTx = await tokenContract.approve(UNISWAP_V3_ROUTER, amountWei);
    await approveTx.wait();
    console.log("Token approved");
  }
}

// Execute the swap
async function executeSwap(
  signer: ethers.Signer,
  inputTokenAddress: string,
  outputTokenAddress: string,
  inputAmount: string,
  outputAmount: string,
  slippage: number,
  decimals: number
): Promise<{ hash: string; gasUsed: string; gasPrice: string }> {
  const router = new ethers.Contract(UNISWAP_V3_ROUTER, ROUTER_ABI, signer);
  const amountInWei = ethers.parseUnits(inputAmount, decimals);
  const amountOutWei = ethers.parseUnits(outputAmount, decimals);
  
  // Calculate minimum amount out with slippage
  const slippageMultiplier = (100 - slippage) / 100;
  const amountOutMinimum = amountOutWei * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
  
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  
  // Try different fee tiers to find the best route
  const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
  let bestSwapParams = null;
  let bestGasEstimate = null;

  for (const fee of feeTiers) {
    try {
      const swapParams = {
        tokenIn: inputTokenAddress,
        tokenOut: outputTokenAddress,
        fee: fee,
        recipient: await signer.getAddress(),
        deadline: deadline,
        amountIn: amountInWei,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      console.log(`🔍 Trying fee tier ${fee} (${fee/10000}%)...`);
      
      // Test gas estimation for this fee tier
      let gasEstimate;
      if (inputTokenAddress === WETH_ADDRESS) {
        gasEstimate = await router.exactInputSingle.estimateGas(swapParams, { value: amountInWei });
      } else {
        gasEstimate = await router.exactInputSingle.estimateGas(swapParams);
      }
      
      console.log(`✅ Fee tier ${fee} works! Gas estimate: ${gasEstimate.toString()}`);
      bestSwapParams = swapParams;
      bestGasEstimate = gasEstimate * 120n / 100n; // Add 20% buffer
      break; // Use the first working fee tier
      
    } catch (error) {
      console.log(`❌ Fee tier ${fee} failed:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }

  // If no fee tier worked, use fallback
  if (!bestSwapParams) {
    console.log("⚠️ No fee tier worked, using fallback with 3000 fee");
    bestSwapParams = {
      tokenIn: inputTokenAddress,
      tokenOut: outputTokenAddress,
      fee: 3000, // 0.3% fee
      recipient: await signer.getAddress(),
      deadline: deadline,
      amountIn: amountInWei,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0,
    };
    
    // Use fallback gas estimate
    if (inputTokenAddress === WETH_ADDRESS) {
      bestGasEstimate = 300000n; // 300k gas
    } else {
      bestGasEstimate = 200000n; // 200k gas
    }
  }

  console.log("🔧 Swap parameters:", {
    tokenIn: inputTokenAddress,
    tokenOut: outputTokenAddress,
    fee: bestSwapParams.fee,
    recipient: await signer.getAddress(),
    deadline: deadline,
    amountIn: amountInWei.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    amountOut: amountOutWei.toString()
  });

  // Use the best gas estimate we found
  const gasEstimate = bestGasEstimate || 300000n; // Fallback if null
  console.log("✅ Using gas estimate:", gasEstimate.toString());

  // Get current gas price
  const gasPrice = await signer.provider!.getFeeData();
  const maxFeePerGas = gasPrice.maxFeePerGas || gasPrice.gasPrice;
  const maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas || 1500000000n; // 1.5 gwei

  // Execute swap with proper transaction construction
  console.log("🚀 Executing swap transaction...");
  let tx;
  try {
    // Construct the transaction data
    const swapData = router.interface.encodeFunctionData("exactInputSingle", [bestSwapParams]);
    console.log("📝 Encoded swap data:", swapData);
    
    // Build transaction object
    const txObject: any = {
      to: UNISWAP_V3_ROUTER,
      data: swapData,
      gasLimit: gasEstimate,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    };
    
    // Add value for ETH swaps
    if (inputTokenAddress === WETH_ADDRESS) {
      console.log("💰 ETH to token swap - including value:", amountInWei.toString());
      txObject.value = amountInWei;
    } else {
      console.log("🔄 Token to token swap");
    }
    
    console.log("📋 Transaction object:", {
      to: txObject.to,
      data: txObject.data.substring(0, 66) + "...", // Show first part of data
      gasLimit: txObject.gasLimit.toString(),
      value: txObject.value?.toString() || "0"
    });
    
    // Send the transaction
    tx = await signer.sendTransaction(txObject);
    console.log("✅ Transaction sent:", tx.hash);
  } catch (error) {
    console.error("❌ Transaction execution failed:", error);
    throw error;
  }

  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  console.log("✅ Transaction confirmed! Gas used:", receipt.gasUsed.toString());
  
  return {
    hash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: receipt.gasPrice?.toString() || "0"
  };
}

// Record swap in database
async function recordSwap(
  walletAddress: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  outputAmount: string,
  transactionHash: string,
  gasUsed: string,
  gasPrice: string
): Promise<void> {
  const db = adminDb();
  if (!db) {
    console.error("Database connection failed");
    return;
  }

  try {
    // Calculate USD values
    const inputTokenInfo = getTokenInfo(inputToken);
    const outputTokenInfo = getTokenInfo(outputToken);
    
    const inputPrice = await getTokenPrice(inputTokenInfo.address);
    const outputPrice = await getTokenPrice(outputTokenInfo.address);
    
    const inputValue = parseFloat(inputAmount) * inputPrice;
    const outputValue = parseFloat(outputAmount) * outputPrice;
    const gasUsedEth = parseFloat(ethers.formatEther(ethers.parseUnits(gasUsed, "wei")));
    const gasPriceEth = parseFloat(ethers.formatEther(ethers.parseUnits(gasPrice, "wei")));
    const gasCost = gasUsedEth * gasPriceEth;
    const ethPrice = await getEthPrice();
    const gasCostUsd = gasCost * ethPrice;

    // Record transaction
    await db.collection("wallet_transactions").add({
      walletAddress,
      type: "swap",
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      inputValue,
      outputValue,
      transactionHash,
      gasUsed,
      gasPrice,
      gasCostUsd,
      timestamp: FieldValue.serverTimestamp(),
      status: "confirmed"
    });

    // Update user points
    const points = Math.floor(inputValue / 100) * 10; // 10 points per $100
    const userQuery = db.collection("users").where("walletAddress", "==", walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      await db.collection("users").doc(userSnapshot.docs[0].id).update({
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection("users").add({
        walletAddress,
        points,
        createdAt: FieldValue.serverTimestamp(),
        lastActivity: FieldValue.serverTimestamp(),
      });
    }

    console.log(`Swap recorded: ${transactionHash}, Points awarded: ${points}`);
  } catch (error) {
    console.error("Error recording swap:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body: SwapRequest = await request.json();
    console.log("Execute API received request:", {
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
      privateKey,
      tokenAddress
    } = body;
    
    if (!inputToken || !outputToken || !inputAmount || !outputAmount || !walletAddress || !privateKey) {
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
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Wallet address mismatch" },
        { status: 400 }
      );
    }
    
    // Check balance
    const hasBalance = await checkBalance(
      provider,
      walletAddress,
      inputTokenInfo.address,
      inputAmount,
      inputTokenInfo.decimals
    );
    
    if (!hasBalance) {
      return NextResponse.json(
        { error: `Insufficient ${inputToken} balance` },
        { status: 400 }
      );
    }
    
    // Check and approve token if needed
    await checkAndApproveToken(wallet, inputTokenInfo.address, inputAmount, inputTokenInfo.decimals);
    
    // Execute swap
    const result = await executeSwap(
      wallet,
      inputTokenInfo.address,
      outputTokenInfo.address,
      inputAmount,
      outputAmount,
      slippage,
      inputTokenInfo.decimals
    );
    
    // Record swap in database
    await recordSwap(
      walletAddress,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      result.hash,
      result.gasUsed,
      result.gasPrice
    );
    
    const response: SwapResponse = {
      success: true,
      transactionHash: result.hash,
      amountOut: outputAmount,
      gasUsed: result.gasUsed,
      gasPrice: result.gasPrice
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Swap execution error:", error);
    
    let errorMessage = "Swap failed";
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("slippage")) {
        errorMessage = "Slippage too high - try increasing slippage tolerance";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Transaction cancelled by user";
      } else if (error.message.includes("execution reverted") || error.message.includes("transaction execution reverted")) {
        errorMessage = "Transaction reverted - this usually means insufficient liquidity or price impact too high. Try a smaller amount or different token pair.";
      } else if (error.message.includes("gas")) {
        errorMessage = "Gas estimation failed - try with a smaller amount";
      } else if (error.message.includes("pool")) {
        errorMessage = "Pool not found - this token pair may not have sufficient liquidity";
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
