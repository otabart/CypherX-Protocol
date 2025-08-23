import { ethers } from 'ethers';

// Configuration
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const AERODROME_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const OUTPUT_TOKEN = "0x6B2504A03ca4D43d0D73776F6aD46dAb2F2a4cFD";
const WALLET_ADDRESS = "0x3185aDE0997fFEC4fdba121809Fca05018B1e274";

// Aerodrome Router ABI (simplified for exactInputSingle)
const AERODROME_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external payable returns (uint256 amountOut)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)"
];

interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  deadline: number;
  amountIn: bigint;
  amountOutMinimum: bigint;
  sqrtPriceLimitX96: bigint;
}

async function debugAerodromeSwap() {
  console.log("🔍 Starting Aerodrome swap debug...");
  
  // Setup provider and contract
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const router = new ethers.Contract(AERODROME_ROUTER, AERODROME_ROUTER_ABI, provider);
  
  // Check if router contract exists
  try {
    const code = await provider.getCode(AERODROME_ROUTER);
    console.log("✅ Router contract exists:", code !== "0x");
    if (code === "0x") {
      throw new Error("Router contract not found at address");
    }
  } catch (error) {
    console.error("❌ Router contract check failed:", error);
    return;
  }

  // Get wallet balance
  try {
    const balance = await provider.getBalance(WALLET_ADDRESS);
    console.log("💰 Wallet ETH balance:", ethers.formatEther(balance));
    
    if (balance < ethers.parseEther("0.001")) {
      console.error("❌ Insufficient ETH balance for swap + gas");
      return;
    }
  } catch (error) {
    console.error("❌ Balance check failed:", error);
    return;
  }

  // Prepare swap parameters
  const amountIn = ethers.parseEther("0.0002"); // 0.0002 ETH
  const amountOutMinimum = ethers.parseUnits("0.000000000000000001", 18); // Very small minimum
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  
  console.log("📋 Swap parameters:", {
    amountIn: ethers.formatEther(amountIn),
    amountOutMinimum: ethers.formatUnits(amountOutMinimum, 18),
    deadline: new Date(deadline * 1000).toISOString()
  });

  // Method 1: Try exactInputSingle (Uniswap V3 style)
  console.log("\n🔄 Method 1: exactInputSingle");
  try {
    const exactInputParams: SwapParams = {
      tokenIn: WETH_ADDRESS,
      tokenOut: OUTPUT_TOKEN,
      fee: 3000, // 0.3%
      recipient: WALLET_ADDRESS,
      deadline: deadline,
      amountIn: amountIn,
      amountOutMinimum: amountOutMinimum,
      sqrtPriceLimitX96: 0n
    };

    console.log("📋 exactInputSingle params:", {
      ...exactInputParams,
      amountIn: ethers.formatEther(exactInputParams.amountIn),
      amountOutMinimum: ethers.formatUnits(exactInputParams.amountOutMinimum, 18)
    });

    // Encode the transaction data
    const exactInputData = router.interface.encodeFunctionData("exactInputSingle", [exactInputParams]);
    console.log("✅ exactInputSingle encoded data:", {
      data: exactInputData,
      dataLength: exactInputData.length,
      dataPreview: exactInputData.substring(0, 66) + "..."
    });

    // Simulate the transaction
    await simulateTransaction(provider, {
      to: AERODROME_ROUTER,
      data: exactInputData,
      value: amountIn
    });

  } catch (error) {
    console.error("❌ exactInputSingle failed:", error);
  }

  // Method 2: Try swap (V3-style DEX)
  console.log("\n🔄 Method 2: swap");
  try {
    const swapParams = [
      WETH_ADDRESS,
      OUTPUT_TOKEN,
      amountIn,
      amountOutMinimum,
      WALLET_ADDRESS,
      deadline
    ];

    console.log("📋 swap params:", {
      tokenIn: swapParams[0],
      tokenOut: swapParams[1],
      amountIn: ethers.formatEther(swapParams[2]),
      amountOutMin: ethers.formatUnits(swapParams[3], 18),
      to: swapParams[4],
      deadline: new Date(swapParams[5] * 1000).toISOString()
    });

    // Encode the transaction data
    const swapData = router.interface.encodeFunctionData("swap", swapParams);
    console.log("✅ swap encoded data:", {
      data: swapData,
      dataLength: swapData.length,
      dataPreview: swapData.substring(0, 66) + "..."
    });

    // Simulate the transaction
    await simulateTransaction(provider, {
      to: AERODROME_ROUTER,
      data: swapData,
      value: amountIn
    });

  } catch (error) {
    console.error("❌ swap failed:", error);
  }

  // Method 3: Try swapExactETHForTokens (V2 style)
  console.log("\n🔄 Method 3: swapExactETHForTokens");
  try {
    const path = [WETH_ADDRESS, OUTPUT_TOKEN];
    const swapExactETHParams = [
      amountOutMinimum,
      path,
      WALLET_ADDRESS,
      deadline
    ];

    console.log("📋 swapExactETHForTokens params:", {
      amountOutMin: ethers.formatUnits(swapExactETHParams[0], 18),
      path: swapExactETHParams[1],
      to: swapExactETHParams[2],
      deadline: new Date(swapExactETHParams[3] * 1000).toISOString()
    });

    // Encode the transaction data
    const swapExactETHData = router.interface.encodeFunctionData("swapExactETHForTokens", swapExactETHParams);
    console.log("✅ swapExactETHForTokens encoded data:", {
      data: swapExactETHData,
      dataLength: swapExactETHData.length,
      dataPreview: swapExactETHData.substring(0, 66) + "..."
    });

    // Simulate the transaction
    await simulateTransaction(provider, {
      to: AERODROME_ROUTER,
      data: swapExactETHData,
      value: amountIn
    });

  } catch (error) {
    console.error("❌ swapExactETHForTokens failed:", error);
  }

  // Check what methods are actually available on the router
  console.log("\n🔍 Checking available methods on router...");
  try {
    const routerCode = await provider.getCode(AERODROME_ROUTER);
    console.log("📏 Router contract size:", routerCode.length);
    
    // Try to get the router interface to see what functions are available
    const routerInterface = new ethers.Interface(AERODROME_ROUTER_ABI);
    console.log("✅ Router interface created with functions:", routerInterface.fragments.map(f => f.name));
    
  } catch (error) {
    console.error("❌ Router method check failed:", error);
  }
}

async function simulateTransaction(provider: ethers.Provider, transaction: any) {
  console.log("🧪 Simulating transaction...");
  
  try {
    // Get current block for simulation
    const blockNumber = await provider.getBlockNumber();
    console.log("📦 Current block:", blockNumber);

    // Simulate the transaction
    const result = await provider.call({
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      from: WALLET_ADDRESS
    });

    console.log("✅ Transaction simulation successful:", {
      result: result,
      resultLength: result.length
    });

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      from: WALLET_ADDRESS
    });

    console.log("⛽ Gas estimate:", gasEstimate.toString());

    // Get fee data
    const feeData = await provider.getFeeData();
    console.log("💰 Fee data:", {
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      gasPrice: feeData.gasPrice?.toString()
    });

    return {
      success: true,
      gasEstimate: gasEstimate,
      feeData: feeData
    };

  } catch (error) {
    console.error("❌ Transaction simulation failed:", error);
    
    // Try to decode the revert reason
    if (error instanceof Error && error.message.includes("execution reverted")) {
      try {
        // Extract revert data from error message
        const revertData = error.message.match(/0x[a-fA-F0-9]+/);
        if (revertData) {
          console.log("🔍 Revert data found:", revertData[0]);
          
          // Try to decode common revert reasons
          const commonErrors = [
            "INSUFFICIENT_OUTPUT_AMOUNT",
            "INSUFFICIENT_LIQUIDITY", 
            "EXPIRED",
            "INSUFFICIENT_INPUT_AMOUNT",
            "INSUFFICIENT_BALANCE"
          ];
          
          for (const errorName of commonErrors) {
            const errorSelector = ethers.id(errorName).substring(0, 10);
            if (revertData[0].includes(errorSelector)) {
              console.log("🎯 Identified revert reason:", errorName);
              break;
            }
          }
        }
      } catch (decodeError) {
        console.log("⚠️ Could not decode revert reason:", decodeError);
      }
    }
    
    return {
      success: false,
      error: error
    };
  }
}

// Check if this is a real Aerodrome router or something else
async function investigateRouter() {
  console.log("\n🔍 Investigating router contract...");
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  
  try {
    // Get contract code
    const code = await provider.getCode(AERODROME_ROUTER);
    console.log("📏 Contract code length:", code.length);
    
    // Check if it's a proxy contract
    if (code.length > 1000) {
      console.log("📋 This appears to be a substantial contract (not empty)");
      
      // Try to get some basic info
      const contract = new ethers.Contract(AERODROME_ROUTER, [
        "function name() external view returns (string)",
        "function symbol() external view returns (string)",
        "function owner() external view returns (address)",
        "function factory() external view returns (address)"
      ], provider);
      
      try {
        const name = await contract.name();
        console.log("🏷️ Contract name:", name);
      } catch (e) {
        console.log("⚠️ Could not get contract name");
      }
      
      try {
        const factory = await contract.factory();
        console.log("🏭 Factory address:", factory);
      } catch (e) {
        console.log("⚠️ Could not get factory address");
      }
      
    } else {
      console.log("⚠️ Contract appears to be empty or very small");
    }
    
  } catch (error) {
    console.error("❌ Router investigation failed:", error);
  }
}

// Main execution
async function main() {
  console.log("🚀 Starting Aerodrome swap investigation...");
  
  await investigateRouter();
  await debugAerodromeSwap();
  
  console.log("\n✅ Investigation complete!");
}

// Run the script
main().catch(console.error);
