import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CypherX/1.0'
      }
    });
    const data = await response.json();
    return data.ethereum?.usd || 3000;
  } catch (error) {
    console.error("Error fetching ETH price:", error);
    // Fallback to our proxy
    try {
      const proxyResponse = await fetch("/api/coingecko-proxy?endpoint=simple/price?ids=ethereum&vs_currencies=usd");
      const proxyData = await proxyResponse.json();
      return proxyData.ethereum?.usd || 3000;
    } catch (proxyError) {
      console.error("Proxy fallback also failed:", proxyError);
      return 3000; // Fallback price
    }
  }
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
      signedTransactionLength: body.signedTransaction.length
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
    
    // Submit the signed transaction
    console.log("🚀 Submitting signed transaction...");
    console.log("📝 Signed transaction length:", signedTransaction.length);
    console.log("📝 Signed transaction preview:", signedTransaction.substring(0, 66) + "...");
    
    // Validate signed transaction
    if (!signedTransaction || signedTransaction.length < 100) {
      throw new Error("Invalid signed transaction data");
    }
    
    // Parse the signed transaction to verify it has the correct data
    try {
      const parsedTx = ethers.Transaction.from(signedTransaction);
      console.log("📋 Parsed transaction details:", {
        to: parsedTx.to,
        data: parsedTx.data ? parsedTx.data.substring(0, 66) + "..." : "NO DATA",
        dataLength: parsedTx.data ? parsedTx.data.length : 0,
        value: parsedTx.value?.toString(),
        nonce: parsedTx.nonce,
        gasLimit: parsedTx.gasLimit?.toString(),
        maxFeePerGas: parsedTx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: parsedTx.maxPriorityFeePerGas?.toString()
      });
      
      // Check if the transaction data is empty
      if (!parsedTx.data || parsedTx.data === "0x") {
        console.error("❌ Transaction data is empty after parsing:", {
          signedTransactionLength: signedTransaction.length,
          parsedTxData: parsedTx.data,
          parsedTxTo: parsedTx.to,
          parsedTxValue: parsedTx.value?.toString()
        });
        throw new Error("Signed transaction has no function call data");
      }
      
      // Additional validation - ensure we have the expected data length
      if (parsedTx.data.length < 10) {
        console.error("❌ Transaction data too short:", parsedTx.data.length);
        throw new Error("Signed transaction data is too short");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse signed transaction:", parseError);
      throw new Error("Invalid signed transaction format");
    }
    
    let tx;
    try {
      tx = await provider.broadcastTransaction(signedTransaction);
      console.log("✅ Transaction broadcasted:", tx.hash);
      
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
            
            throw new Error(`Transaction reverted: ${revertReason}`);
          } else {
            throw new Error("Transaction execution reverted - insufficient liquidity or price impact too high");
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
    
    let errorMessage = "Failed to submit swap";
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("nonce")) {
        errorMessage = "Transaction nonce error - try again";
      } else if (error.message.includes("gas")) {
        errorMessage = "Gas estimation failed";
      } else if (error.message.includes("execution reverted")) {
        errorMessage = "Transaction reverted - insufficient liquidity or price impact too high";
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
