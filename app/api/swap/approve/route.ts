import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Constants
const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// DEX Router Addresses on Base Chain - Updated with verified addresses
const DEX_ROUTERS = {
  uniswap_v2: {
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    factory: "0x8909dc15e40173ff4699343b6eb8132c65e18ec6",
    version: "v2"
  },
  aerodrome: {
    router: "0xE9992487b2EE03b7a91241695A58E0ef3654643E", // Verified Aerodrome router
    factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", // Aerodrome factory
    version: "v2"
  },
  uniswap_v3: {
    router: "0x6ff5693b99212da76ad316178a184ab56d299b43", // SwapRouter2
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", // Uniswap V3 factory
    version: "v3"
  },
  baseswap: {
    router: "0xFD14567eaf9ba9b71d4a6b255d96842dEF71D2bE", // Verified BaseSwap router
    factory: "0xFDa619b6d209A7e7De1A5c7C7bDC9F1bEA73f33a", // BaseSwap factory
    version: "v2"
  },
  sushiswap: {
    router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Router02
    factory: "0xc35DADB65012eC5796536bD9864eD8773ABc74C4", // SushiSwap factory
    version: "v2"
  },
  oneinch: {
    router: "0x1111111254EEB25477B68fb85Ed929f73A960582", // AggregationRouterV5
    version: "aggregator"
  }
};

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
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

interface ApproveRequest {
  tokenAddress: string;
  amount: string;
  walletAddress: string;
  privateKey: string;
  preferredDex?: string;
  approvalType?: "exact" | "buffer" | "max";
}

// Get token info
async function getTokenInfo(tokenAddress: string, provider: ethers.Provider) {
  if (tokenAddress === WETH_ADDRESS) {
    return {
      address: WETH_ADDRESS,
      symbol: "WETH",
      name: "Wrapped Ethereum",
      decimals: 18
    };
  }

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, name, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals()
    ]);

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals
    };
  } catch (error) {
    throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check current allowance
async function checkAllowance(
  provider: ethers.Provider,
  tokenAddress: string,
  walletAddress: string,
  routerAddress: string,
  decimals: number
): Promise<{ currentAllowance: bigint; formattedAllowance: string }> {
  if (tokenAddress === WETH_ADDRESS) {
    return { currentAllowance: ethers.MaxUint256, formattedAllowance: "∞" };
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const currentAllowance = await tokenContract.allowance(walletAddress, routerAddress);
  
  return {
    currentAllowance,
    formattedAllowance: ethers.formatUnits(currentAllowance, decimals)
  };
}

// 🔧 FIXED: Enhanced token approval with better error handling and validation
async function approveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  routerAddress: string,
  amount: string,
  decimals: number,
  approvalType: "exact" | "buffer" | "max" = "buffer"
): Promise<{ hash: string; approvedAmount: string }> {
  if (tokenAddress === WETH_ADDRESS) {
    throw new Error("WETH does not require approval");
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  // 🔧 FIXED: Better amount validation and parsing
  let amountWei: bigint;
  try {
    amountWei = ethers.parseUnits(amount, decimals);
    if (amountWei <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
  } catch (parseError) {
    throw new Error(`Invalid amount format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  let approvalAmount: bigint;
  let approvalTypeDescription: string;

  switch (approvalType) {
    case "exact":
      approvalAmount = amountWei;
      approvalTypeDescription = "exact amount";
      break;
    case "buffer":
      approvalAmount = amountWei * 150n / 100n; // 50% buffer for better safety
      approvalTypeDescription = "amount with 50% buffer";
      break;
    case "max":
      approvalAmount = ethers.MaxUint256;
      approvalTypeDescription = "maximum amount";
      break;
    default:
      approvalAmount = amountWei * 150n / 100n;
      approvalTypeDescription = "amount with 50% buffer";
  }

  console.log(`🔧 Approving ${approvalTypeDescription}:`, {
    originalAmount: amount,
    originalAmountWei: amountWei.toString(),
    approvalAmount: ethers.formatUnits(approvalAmount, decimals),
    approvalAmountWei: approvalAmount.toString(),
    tokenAddress,
    routerAddress,
    decimals
  });

  try {
    // 🔧 FIXED: Check current allowance first
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
    console.log("📊 Current allowance:", {
      current: ethers.formatUnits(currentAllowance, decimals),
      currentWei: currentAllowance.toString()
    });

    // 🔧 FIXED: Only approve if needed
    if (currentAllowance >= approvalAmount) {
      console.log("✅ Sufficient allowance already exists");
      return {
        hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        approvedAmount: ethers.formatUnits(currentAllowance, decimals)
      };
    }

    // 🔧 FIXED: First try to reset allowance to 0 (some tokens require this)
    try {
      console.log("🔄 Resetting allowance to 0 first...");
      const resetTx = await tokenContract.approve(routerAddress, 0n);
      await resetTx.wait();
      console.log("✅ Allowance reset successful");
    } catch (resetError) {
      console.log("⚠️ Allowance reset failed, continuing with direct approval:", resetError);
    }

    // 🔧 FIXED: Perform the actual approval
    console.log("🔄 Sending approval transaction...");
    const approveTx = await tokenContract.approve(routerAddress, approvalAmount);
    console.log("⏳ Waiting for approval transaction...");
    
    const receipt = await approveTx.wait();
    
    // 🔧 FIXED: Verify the approval was successful
    const newAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
    
    console.log("✅ Token approval successful:", {
      hash: receipt.hash,
      requestedAmount: ethers.formatUnits(approvalAmount, decimals),
      newAllowance: ethers.formatUnits(newAllowance, decimals),
      status: receipt.status === 1 ? "success" : "failed"
    });

    // 🔧 FIXED: Check if approval was actually successful
    if (receipt.status !== 1) {
      throw new Error("Approval transaction reverted");
    }

    if (newAllowance < approvalAmount) {
      throw new Error(`Approval failed: requested ${ethers.formatUnits(approvalAmount, decimals)}, got ${ethers.formatUnits(newAllowance, decimals)}`);
    }

    return {
      hash: receipt.hash,
      approvedAmount: ethers.formatUnits(newAllowance, decimals)
    };
  } catch (error) {
    console.error("❌ Token approval failed:", error);
    
    // 🔧 FIXED: Better error categorization
    let errorMessage = "Token approval failed";
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "User rejected the transaction";
      } else if (error.message.includes("execution reverted")) {
        errorMessage = "Transaction reverted - check token contract";
      } else if (error.message.includes("nonce")) {
        errorMessage = "Nonce error - try again";
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function POST(request: Request) {
  try {
    console.log("🔧 Token approval request received");
    
    const body: ApproveRequest = await request.json();
    console.log("📋 Request body:", JSON.stringify(body, null, 2));
    
    const { 
      tokenAddress, 
      amount, 
      walletAddress, 
      privateKey, 
      preferredDex = "uniswap_v2",
      approvalType = "buffer"
    } = body;

    // Validate inputs
    if (!tokenAddress || !amount || !walletAddress || !privateKey) {
      return NextResponse.json({
        success: false,
        error: "MISSING_PARAMETERS",
        message: "Missing required parameters for token approval"
      }, { status: 400 });
    }

    // Validate token address
    if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
      return NextResponse.json({
        success: false,
        error: "INVALID_TOKEN_ADDRESS",
        message: "Invalid token address format"
      }, { status: 400 });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({
        success: false,
        error: "INVALID_AMOUNT",
        message: "Amount must be a positive number"
      }, { status: 400 });
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({
        success: false,
        error: "WALLET_ADDRESS_MISMATCH",
        message: "Wallet address does not match private key"
      }, { status: 400 });
    }

    // Get DEX router address
    const dexConfig = DEX_ROUTERS[preferredDex as keyof typeof DEX_ROUTERS];
    if (!dexConfig) {
      return NextResponse.json({
        success: false,
        error: "UNSUPPORTED_DEX",
        message: `DEX ${preferredDex} is not supported`
      }, { status: 400 });
    }

    // Get token information
    const tokenInfo = await getTokenInfo(tokenAddress, provider);
    console.log("🔍 Token info:", tokenInfo);

    // Check current allowance
    const { currentAllowance, formattedAllowance } = await checkAllowance(
      provider,
      tokenAddress,
      walletAddress,
      dexConfig.router,
      tokenInfo.decimals
    );

    console.log("📊 Current allowance:", {
      current: formattedAllowance,
      required: amount,
      token: tokenInfo.symbol
    });

    // 🔧 FIXED: Better approval need checking
    const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
    const requiredAllowance = approvalType === "buffer" ? amountWei * 120n / 100n : amountWei;

    console.log("📊 Approval analysis:", {
      currentAllowance: currentAllowance.toString(),
      requiredAllowance: requiredAllowance.toString(),
      currentFormatted: formattedAllowance,
      requiredFormatted: ethers.formatUnits(requiredAllowance, tokenInfo.decimals),
      approvalNeeded: currentAllowance < requiredAllowance
    });

    if (currentAllowance >= requiredAllowance) {
      return NextResponse.json({
        success: true,
        message: "Sufficient allowance already exists",
        data: {
          currentAllowance: formattedAllowance,
          requiredAmount: amount,
          tokenSymbol: tokenInfo.symbol,
          approvalNeeded: false,
          transactionHash: null
        }
      });
    }

    // Perform approval
    const approvalResult = await approveToken(
      wallet,
      tokenAddress,
      dexConfig.router,
      amount,
      tokenInfo.decimals,
      approvalType
    );

    // Check new allowance
    const { formattedAllowance: newAllowance } = await checkAllowance(
      provider,
      tokenAddress,
      walletAddress,
      dexConfig.router,
      tokenInfo.decimals
    );

    return NextResponse.json({
      success: true,
      message: "Token approval successful",
      data: {
        transactionHash: approvalResult.hash,
        approvedAmount: approvalResult.approvedAmount,
        currentAllowance: newAllowance,
        tokenSymbol: tokenInfo.symbol,
        dexUsed: preferredDex,
        approvalType: approvalType,
        approvalNeeded: true
      }
    });

  } catch (error) {
    console.error("❌ Token approval error:", error);
    
    let errorMessage = "Token approval failed";
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance for approval";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Approval cancelled by user";
      } else if (error.message.includes("execution reverted")) {
        errorMessage = "Approval transaction reverted - check token contract";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({
      success: false,
      error: "APPROVAL_FAILED",
      message: errorMessage
    }, { status: 500 });
  }
}