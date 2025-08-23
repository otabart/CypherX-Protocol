import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
// Removed formatSwapError import - function no longer exists

// Constants
const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";

interface SubmitSwapRequest {
  signedTransaction: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  walletAddress: string;
  tokenAddress?: string;
  autoConfirm?: boolean; // New option to auto-confirm
}



async function getEthPrice(): Promise<number> {
  // Try DexScreener first (most reliable and no rate limits)
  try {
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
        return parseFloat(wethUsdcPair.priceUsd);
      }
      
      // Fallback to any WETH pair with price on Base
      const wethPair = dexData.pairs.find((pair: any) => 
        pair.baseToken?.address === "0x4200000000000000000000000000000000000006" && 
        pair.priceUsd && 
        pair.chainId === "base"
      );
      if (wethPair?.priceUsd) {
        return parseFloat(wethPair.priceUsd);
      }
    }
  } catch (dexError) {
    console.error("DexScreener ETH price fetch failed:", dexError);
  }

  // Try alternative price APIs with better rate limits
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
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const price = api.parser(data);
      
      if (price && price > 0) {
        return price;
      }
    } catch (error) {
      continue; // Try next API
    }
  }

  // Last resort: use our proxy
  try {
    const proxyResponse = await fetch("/api/coingecko-proxy?endpoint=simple/price?ids=ethereum&vs_currencies=usd");
    const proxyData = await proxyResponse.json();
    const ethPrice = proxyData.ethereum?.usd || 0;
    
    if (ethPrice > 0) {
      return ethPrice;
    }
  } catch (proxyError) {
    console.error("Proxy fallback also failed:", proxyError);
  }
  
  // No fallback - throw error if no real price found
  throw new Error("Failed to fetch real ETH price from all sources");
}

async function getTokenPrice(tokenAddress: string): Promise<number> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      return parseFloat(data.pairs[0].priceUsd) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error("Error fetching token price:", error);
    return 0;
  }
}

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
    const inputPrice = await getTokenPrice(inputToken === "ETH" ? "0x4200000000000000000000000000000000000006" : inputToken);
    const outputPrice = await getTokenPrice(outputToken === "ETH" ? "0x4200000000000000000000000000000000000006" : outputToken);
    
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
        points: points,
        lastActivity: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      });
    }

    console.log("✅ Swap recorded in database");
  } catch (error) {
    console.error("Error recording swap:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body: SubmitSwapRequest = await request.json();
    console.log("Submit swap request:", {
      inputToken: body.inputToken,
      outputToken: body.outputToken,
      inputAmount: body.inputAmount,
      outputAmount: body.outputAmount,
      walletAddress: body.walletAddress,
      signedTransactionLength: body.signedTransaction.length,
      signedTransactionPrefix: body.signedTransaction.substring(0, 66) + "...",
      signedTransaction: body.signedTransaction
    });
    
    const { 
      signedTransaction, 
      inputToken, 
      outputToken, 
      inputAmount, 
      outputAmount, 
      walletAddress,
      autoConfirm = true // Default to auto-confirm
    } = body;
    
    if (!signedTransaction || !inputToken || !outputToken || !inputAmount || !outputAmount || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Pre-check wallet balances before attempting transaction
    console.log("🔍 Checking wallet balances...");
    const walletBalance = await provider.getBalance(walletAddress);
    const walletBalanceEth = ethers.formatEther(walletBalance);
    console.log("💰 Wallet ETH balance:", walletBalanceEth);
    
    // Check if input token is ETH and if balance is sufficient
    if (inputToken === "ETH") {
      const requiredAmount = ethers.parseEther(inputAmount);
      
      // Estimate gas cost for the transaction
      let estimatedGasCost = 0n;
      try {
        const feeData = await provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n;
        const estimatedGasLimit = 200000n; // Conservative estimate
        estimatedGasCost = maxFeePerGas * estimatedGasLimit;
      } catch (gasError) {
        console.error("Error estimating gas cost:", gasError);
        // Use conservative estimate
        estimatedGasCost = 1000000000n * 200000n; // 0.2 ETH
      }
      
      const totalRequired = requiredAmount + estimatedGasCost;
      console.log("💰 Balance check:", {
        walletBalance: walletBalanceEth,
        swapAmount: inputAmount,
        estimatedGasCost: ethers.formatEther(estimatedGasCost),
        totalRequired: ethers.formatEther(totalRequired)
      });
      
      if (walletBalance < totalRequired) {
        const shortfall = totalRequired - walletBalance;
        return NextResponse.json(
          { 
            error: `Insufficient ETH balance for swap + gas. Required: ${ethers.formatEther(totalRequired)} ETH (${inputAmount} for swap + ${ethers.formatEther(estimatedGasCost)} for gas), Available: ${walletBalanceEth} ETH. Need ${ethers.formatEther(shortfall)} more ETH.` 
          },
          { status: 400 }
        );
      }
    } else {
      // Check token balance for non-ETH tokens
      try {
        const tokenContract = new ethers.Contract(
          inputToken,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          provider
        );
        
        const [tokenBalance, decimals] = await Promise.all([
          tokenContract.balanceOf(walletAddress),
          tokenContract.decimals()
        ]);
        
        const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, decimals);
        console.log(`💰 Token balance: ${tokenBalanceFormatted} ${inputToken} (${decimals} decimals)`);
        
        const requiredAmount = ethers.parseUnits(inputAmount, decimals);
        
        console.log(`🔍 Balance check: Required=${ethers.formatUnits(requiredAmount, decimals)}, Available=${ethers.formatUnits(tokenBalance, decimals)}`);
        console.log(`🔍 Raw comparison: tokenBalance=${tokenBalance.toString()}, requiredAmount=${requiredAmount.toString()}`);
        
        // 🔧 ENHANCED: Better balance validation for sell operations
        if (tokenBalance < requiredAmount) {
          // If the shortfall is very small (less than 0.01% of required amount), allow the transaction
          const shortfall = requiredAmount - tokenBalance;
          const shortfallPercentage = (shortfall * BigInt(10000)) / requiredAmount; // 0.01% = 1
          
          console.log(`🔍 Shortfall analysis: shortfall=${ethers.formatUnits(shortfall, decimals)}, percentage=${shortfallPercentage.toString()}`);
          
          if (shortfallPercentage > BigInt(1)) { // More than 0.01% shortfall
            console.log(`❌ Insufficient balance: shortfall=${shortfall.toString()}`);
            return NextResponse.json(
              { 
                error: `Insufficient token balance. Required: ${inputAmount} (${ethers.formatUnits(requiredAmount, decimals)} with ${decimals} decimals), Available: ${tokenBalanceFormatted}. Need ${ethers.formatUnits(shortfall, decimals)} more.` 
              },
              { status: 400 }
            );
          } else {
            console.log(`✅ Allowing transaction with small shortfall: ${ethers.formatUnits(shortfall, decimals)} (${shortfallPercentage.toString()}/10000%)`);
          }
        }
        
        console.log(`✅ Sufficient balance: user has ${ethers.formatUnits(tokenBalance, decimals)} tokens, trying to sell ${ethers.formatUnits(requiredAmount, decimals)} tokens`);
      } catch (tokenError) {
        console.error("Error checking token balance:", tokenError);
        // Continue with transaction if we can't check token balance
      }
    }
    
    // Submit the signed transaction
    console.log("🚀 Submitting signed transaction...");
    console.log("📝 Signed transaction length:", signedTransaction.length);
    console.log("📝 Signed transaction preview:", signedTransaction.substring(0, 66) + "...");
    
    // Validate signed transaction format
    if (!signedTransaction || signedTransaction.length < 100) {
      throw new Error("Invalid signed transaction data - too short");
    }
    
    if (!signedTransaction.startsWith("0x")) {
      throw new Error("Invalid signed transaction format - must start with 0x");
    }
    
    // Validate signed transaction format (skip parsing due to EIP-1559 issues)
    if (!signedTransaction || signedTransaction.length < 100) {
      throw new Error("Invalid signed transaction data - too short");
    }
    
    if (!signedTransaction.startsWith("0x")) {
      throw new Error("Invalid signed transaction format - must start with 0x");
    }
    
    console.log("📋 Signed transaction validation:", {
      length: signedTransaction.length,
      startsWith0x: signedTransaction.startsWith("0x"),
      preview: signedTransaction.substring(0, 66) + "..."
    });
    
    // Parse the signed transaction to verify it has data
    let parsedTx;
    try {
      parsedTx = ethers.Transaction.from(signedTransaction);
      console.log("🔍 Parsed transaction details:", {
        to: parsedTx.to,
        data: parsedTx.data ? parsedTx.data.substring(0, 66) + "..." : "No data",
        dataLength: parsedTx.data ? parsedTx.data.length : 0,
        hasData: !!parsedTx.data && parsedTx.data !== "0x",
        value: parsedTx.value?.toString(),
        nonce: parsedTx.nonce,
        gasLimit: parsedTx.gasLimit?.toString(),
        maxFeePerGas: parsedTx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: parsedTx.maxPriorityFeePerGas?.toString()
      });
      
      // 🔧 CRITICAL: Validate transaction data integrity
      if (!parsedTx.data || parsedTx.data === "0x" || parsedTx.data.length < 10) {
        console.error("❌ CRITICAL: Transaction has empty or invalid data:", {
          data: parsedTx.data,
          dataLength: parsedTx.data ? parsedTx.data.length : 0,
          signedTransactionLength: signedTransaction.length,
          signedTransactionPreview: signedTransaction.substring(0, 100) + "..."
        });
        throw new Error("Signed transaction has empty or invalid data - this indicates a frontend encoding issue");
      }
      
      // 🔧 ENHANCED: Check token allowance for sell operations after parsing
      if (inputToken !== "ETH" && parsedTx.to) {
        try {
          const tokenContract = new ethers.Contract(
            inputToken,
            ["function allowance(address,address) view returns (uint256)", "function decimals() view returns (uint8)"],
            provider
          );
          
          const [allowance, decimals] = await Promise.all([
            tokenContract.allowance(walletAddress, parsedTx.to),
            tokenContract.decimals()
          ]);
          
          const requiredAmount = ethers.parseUnits(inputAmount, decimals);
          console.log(`🔍 Token allowance check: ${ethers.formatUnits(allowance, decimals)} tokens approved for router`);
          
          if (allowance < requiredAmount) {
            console.warn(`⚠️ Insufficient token allowance: ${ethers.formatUnits(allowance, decimals)} < ${ethers.formatUnits(requiredAmount, decimals)}`);
            return NextResponse.json(
              { 
                error: `Insufficient token allowance. Required: ${ethers.formatUnits(requiredAmount, decimals)}, Approved: ${ethers.formatUnits(allowance, decimals)}. Please approve the router contract to spend your tokens.` 
              },
              { status: 400 }
            );
          }
          
          console.log(`✅ Sufficient token allowance: ${ethers.formatUnits(allowance, decimals)} >= ${ethers.formatUnits(requiredAmount, decimals)}`);
        } catch (allowanceError) {
          console.warn("⚠️ Could not check token allowance:", allowanceError);
          // Continue with transaction if we can't check allowance
        }
      }
      
      // 🔧 ENHANCED: Detect transaction type and add specific validation
      const methodSignature = parsedTx.data.substring(0, 10);
      console.log("🔍 Transaction method signature:", methodSignature);
      
      // Check if this is a sell operation (swapExactTokensForETH)
      if (methodSignature === "0x38ed1739") { // swapExactTokensForETH
        console.log("🔍 Detected SELL operation (swapExactTokensForETH)");
        
        // 🔧 ENHANCED: Decode sell operation parameters
        try {
          const sellParams = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint256", "uint256", "address[]", "address", "uint256"],
            "0x" + parsedTx.data.substring(10) // Remove method signature
          );
          
          console.log("🔍 SELL operation details:", {
            tokenAmountIn: ethers.formatUnits(sellParams[0], 18), // Assuming 18 decimals
            minEthOut: ethers.formatEther(sellParams[1]),
            tokenPath: sellParams[2],
            recipient: sellParams[3],
            deadline: new Date(Number(sellParams[4]) * 1000).toISOString(),
            tokenBeingSold: sellParams[2][0], // First token in path
            ethBeingReceived: ethers.formatEther(sellParams[1])
          });
          
          // Validate sell operation parameters
          if (sellParams[2].length < 2) {
            console.warn("⚠️ Sell operation has invalid path length");
          }
          
          if (Number(sellParams[4]) < Math.floor(Date.now() / 1000)) {
            console.warn("⚠️ Sell operation deadline has expired");
          }
          
        } catch (decodeError) {
          console.error("❌ Failed to decode sell operation parameters:", decodeError);
        }
        
        // Additional validation for sell operations
        if (parsedTx.value && parsedTx.value > 0n) {
          console.warn("⚠️ Sell operation has non-zero value - this might be incorrect");
        }
        
        // Check if the transaction has proper data length for sell operation
        if (parsedTx.data.length < 138) { // Minimum length for swapExactTokensForETH
          console.warn("⚠️ Sell operation data seems too short");
        }
      } else if (methodSignature === "0x7ff36ab5") { // swapExactETHForTokens
        console.log("🔍 Detected BUY operation (swapExactETHForTokens)");
        
        // Additional validation for buy operations
        if (!parsedTx.value || parsedTx.value === 0n) {
          console.warn("⚠️ Buy operation has zero value - this might be incorrect");
        }
      } else {
        console.log("🔍 Unknown transaction method:", methodSignature);
      }
      
      if (!parsedTx.data || parsedTx.data === "0x" || parsedTx.data.length < 10) {
        throw new Error("Signed transaction has empty or invalid data");
      }

      console.log("✅ Transaction data validation passed");
    } catch (parseError) {
      console.error("❌ Transaction parsing/simulation error:", parseError);
      throw new Error("Invalid signed transaction - parsing or simulation failed");
    }
    
    let tx;
    try {
      console.log("🔍 Broadcasting transaction with hash:", signedTransaction.substring(0, 66) + "...");
      
      // 🔧 CRITICAL: Validate signed transaction before broadcasting
      console.log("🔍 Pre-broadcast validation:", {
        signedTransactionLength: signedTransaction.length,
        signedTransactionPrefix: signedTransaction.substring(0, 66) + "...",
        parsedTxData: parsedTx.data ? parsedTx.data.substring(0, 66) + "..." : "No data",
        parsedTxDataLength: parsedTx.data ? parsedTx.data.length : 0
      });
      
      // 🔧 CRITICAL: Re-parse the signed transaction to ensure data integrity
      const reParsedTx = ethers.Transaction.from(signedTransaction);
      console.log("🔍 Re-parsed transaction before broadcast:", {
        to: reParsedTx.to,
        data: reParsedTx.data ? reParsedTx.data.substring(0, 66) + "..." : "No data",
        dataLength: reParsedTx.data ? reParsedTx.data.length : 0,
        hasData: !!reParsedTx.data && reParsedTx.data !== "0x"
      });
      
      if (!reParsedTx.data || reParsedTx.data === "0x" || reParsedTx.data.length < 10) {
        console.error("❌ CRITICAL: Re-parsed transaction has empty data before broadcast!");
        throw new Error("Signed transaction has empty data - frontend encoding issue");
      }
      
      tx = await provider.broadcastTransaction(signedTransaction);
      console.log("✅ Transaction broadcasted successfully:", tx.hash);
      
      // Log transaction details for debugging
      console.log("📊 Transaction details:", {
        hash: tx.hash,
        from: walletAddress,
        to: tx.to,
        value: tx.value?.toString(),
        dataLength: tx.data?.length || 0,
        nonce: tx.nonce,
        gasLimit: tx.gasLimit?.toString(),
        maxFeePerGas: tx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString()
      });
      
      // If autoConfirm is false, return immediately after broadcasting
      if (!autoConfirm) {
        return NextResponse.json({
          success: true,
          transactionHash: tx.hash,
          status: "broadcasted",
          message: "Transaction broadcasted successfully"
        });
      }
    } catch (broadcastError) {
      console.error("❌ Broadcast error details:", {
        error: broadcastError,
        message: broadcastError instanceof Error ? broadcastError.message : 'Unknown error',
        code: (broadcastError as any)?.code,
        errorData: (broadcastError as any)?.error,
        stack: broadcastError instanceof Error ? broadcastError.stack : undefined
      });
      
      // Check for specific error types
      if (broadcastError instanceof Error) {
        if (broadcastError.message.includes("insufficient funds")) {
          throw new Error("Insufficient balance for transaction");
        } else if (broadcastError.message.includes("nonce")) {
          throw new Error("Transaction nonce error - try again");
        } else if (broadcastError.message.includes("already known")) {
          throw new Error("Transaction already submitted");
        } else if (broadcastError.message.includes("replacement transaction")) {
          throw new Error("Transaction replacement error");
        }
      }
      
      throw broadcastError;
    }
    
    // Wait for confirmation with shorter timeout
    console.log("⏳ Waiting for transaction confirmation...");
    let receipt: any;
    try {
      // Use a shorter timeout for faster response
      receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Confirmation timeout")), 15000) // 15 second timeout
        )
      ]);
      
      console.log("🔍 Raw transaction receipt:", JSON.stringify(receipt, null, 2));
      
      // Check if transaction was successful
      if (receipt && receipt.status === 0) {
        console.error("❌ Transaction failed with status 0");
        console.error("🔍 Full receipt data:", JSON.stringify(receipt, null, 2));
        
        // Try to get more detailed error information
        try {
          const txDetails = await provider.getTransaction(tx.hash);
          console.log("🔍 Failed transaction details:", {
            hash: tx.hash,
            to: txDetails?.to,
            data: txDetails?.data?.substring(0, 66) + "...",
            value: txDetails?.value?.toString(),
            gasLimit: txDetails?.gasLimit?.toString()
          });
          
          // Try to get the transaction trace for more details
          try {
            const trace = await provider.send("debug_traceTransaction", [tx.hash, {}]);
            console.log("🔍 Transaction trace:", JSON.stringify(trace, null, 2));
          } catch (traceError) {
            console.log("Could not get transaction trace:", traceError);
          }
        } catch (detailError) {
          console.error("Failed to get transaction details:", detailError);
        }
        
        throw new Error("Transaction execution reverted - check slippage tolerance and liquidity");
      }
      
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }
      console.log("✅ Transaction confirmed! Gas used:", receipt.gasUsed.toString());
      console.log("📊 Transaction details:", {
        hash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice?.toString() || "0",
        status: receipt.status
      });
    } catch (confirmationError) {
      console.error("❌ Transaction confirmation failed:", {
        error: confirmationError,
        message: confirmationError instanceof Error ? confirmationError.message : 'Unknown error',
        hash: tx.hash,
        stack: confirmationError instanceof Error ? confirmationError.stack : undefined
      });
      
      if (confirmationError instanceof Error) {
        if (confirmationError.message.includes("execution reverted")) {
          // Check the transaction receipt for more specific error information
          if (receipt && receipt.status === 0) {
            console.error("Transaction failed with status 0:", {
              gasUsed: receipt.gasUsed?.toString(),
              gasPrice: receipt.gasPrice?.toString(),
              logs: receipt.logs
            });
            
            // Try to decode the revert reason from logs
            let revertReason = "Transaction reverted";
            if (receipt.logs && receipt.logs.length > 0) {
              try {
                // Look for revert reason in logs
                for (const log of receipt.logs) {
                  if (log.data && log.data !== "0x") {
                    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], log.data);
                    if (decoded && decoded[0]) {
                      revertReason = decoded[0];
                      break;
                    }
                  }
                }
              } catch (decodeError) {
                console.error("Failed to decode revert reason:", decodeError);
              }
            }
            
            // Check for common revert reasons
            if (revertReason.includes("INSUFFICIENT_OUTPUT_AMOUNT") || revertReason.includes("insufficient output amount")) {
              throw new Error("Transaction reverted: Slippage tolerance exceeded - try increasing slippage or reducing trade size");
            } else if (revertReason.includes("INSUFFICIENT_LIQUIDITY") || revertReason.includes("insufficient liquidity")) {
              throw new Error("Transaction reverted: Insufficient liquidity in pool - try a smaller trade size");
            } else if (revertReason.includes("EXPIRED") || revertReason.includes("expired")) {
              throw new Error("Transaction reverted: Transaction deadline expired - try again");
            } else if (revertReason.includes("INSUFFICIENT_INPUT_AMOUNT") || revertReason.includes("insufficient input amount")) {
              throw new Error("Transaction reverted: Insufficient input amount - check your balance");
            } else {
              throw new Error(`Transaction reverted: ${revertReason}`);
            }
          } else {
            // 🔧 ENHANCED: Better error analysis for sell operations
            const methodSignature = parsedTx.data.substring(0, 10);
            let errorMessage = "Transaction execution reverted - unknown error";
            
            if (methodSignature === "0x38ed1739") { // swapExactTokensForETH
              console.log("🔍 Analyzing SELL operation failure...");
              
              // 🔧 ENHANCED: Decode sell parameters for better error analysis
              try {
                const sellParams = ethers.AbiCoder.defaultAbiCoder().decode(
                  ["uint256", "uint256", "address[]", "address", "uint256"],
                  "0x" + parsedTx.data.substring(10)
                );
                
                console.log("🔍 Failed SELL operation analysis:", {
                  tokenAmountIn: ethers.formatUnits(sellParams[0], 18),
                  minEthOut: ethers.formatEther(sellParams[1]),
                  tokenPath: sellParams[2],
                  tokenBeingSold: sellParams[2][0],
                  deadline: new Date(Number(sellParams[4]) * 1000).toISOString()
                });
                
                // Check for specific sell operation failure reasons
                if (receipt.logs && receipt.logs.length === 0) {
                  errorMessage = `Sell operation failed - insufficient token allowance or balance. Trying to sell ${ethers.formatUnits(sellParams[0], 18)} tokens`;
                } else if (receipt.logs && receipt.logs.length > 0) {
                  // Try to decode revert reason from logs
                  for (const log of receipt.logs) {
                    if (log.data && log.data !== "0x") {
                      try {
                        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], log.data);
                        if (decoded && decoded[0]) {
                          errorMessage = `Sell operation failed: ${decoded[0]}`;
                          break;
                        }
                      } catch (decodeError) {
                        // Continue to next log
                      }
                    }
                  }
                  
                  if (errorMessage === "Transaction execution reverted - unknown error") {
                    errorMessage = `Sell operation failed - check token allowance and balance. Trying to sell ${ethers.formatUnits(sellParams[0], 18)} tokens`;
                  }
                }
                
                // Check for deadline expiration
                if (Number(sellParams[4]) < Math.floor(Date.now() / 1000)) {
                  errorMessage = "Sell operation failed - transaction deadline expired";
                }
                
              } catch (decodeError) {
                console.error("❌ Failed to decode sell parameters for error analysis:", decodeError);
                errorMessage = "Sell operation failed - check token allowance and balance";
              }
              
            } else if (methodSignature === "0x7ff36ab5") { // swapExactETHForTokens
              console.log("🔍 Analyzing BUY operation failure...");
              errorMessage = "Buy operation failed - check ETH balance and slippage";
            }
            
            throw new Error(errorMessage);
          }
        } else if (confirmationError.message.includes("timeout")) {
          throw new Error("Transaction confirmation timeout - check your transaction hash");
        } else if (confirmationError.message.includes("replacement")) {
          throw new Error("Transaction replacement error");
        }
      }
      
      throw confirmationError;
    }
    
    // Record swap in database
    await recordSwap(
      walletAddress,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      tx.hash,
      receipt.gasUsed.toString(),
      receipt.gasPrice?.toString() || "0"
    );
    
    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.gasPrice?.toString() || "0"
    });
    
  } catch (error) {
    console.error("Submit swap error:", error);
    
    // Enhanced error handling with specific error types
    let errorMessage = "Transaction failed";
    let errorDetails = "An unexpected error occurred during the swap";
    let statusCode = 500;
    let userFriendlyError = null;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Format user-friendly error message
      userFriendlyError = error.message;
      
      if (error.message.includes("execution reverted")) {
        errorDetails = "The swap transaction was reverted by the smart contract. This usually means insufficient liquidity or invalid parameters.";
        statusCode = 400;
      } else if (error.message.includes("insufficient funds")) {
        errorDetails = "Your wallet doesn't have enough ETH to complete this transaction.";
        statusCode = 400;
      } else if (error.message.includes("nonce too low")) {
        errorDetails = "Transaction nonce is too low. Please try again.";
        statusCode = 400;
      } else if (error.message.includes("timeout")) {
        errorDetails = "Transaction confirmation timed out. Please check your transaction hash on the blockchain explorer.";
        statusCode = 408;
      } else if (error.message.includes("replacement")) {
        errorDetails = "Transaction replacement error. Please try again with a different nonce.";
        statusCode = 400;
      } else if (error.message.includes("No Uniswap V3 pools found")) {
        errorDetails = "No trading pools found for this token pair. The token may not be listed on Uniswap V3.";
        statusCode = 400;
      } else if (error.message.includes("Insufficient liquidity")) {
        errorDetails = "The pool doesn't have enough liquidity for this trade. Try a smaller amount.";
        statusCode = 400;
      }
    }
    
    // Log detailed error information for debugging
    console.error("Detailed error information:", {
      error: errorMessage,
      details: errorDetails,
      userFriendly: userFriendlyError,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: errorDetails,
        userFriendly: userFriendlyError
      },
      { status: statusCode }
    );
  }
}
