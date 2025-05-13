import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { type DocumentData } from "firebase-admin/firestore";
import admin from "firebase-admin";

// Environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_WS_URL =
  process.env.ALCHEMY_WS_URL ||
  `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY is not set");
  throw new Error("ALCHEMY_API_KEY is not set in environment variables");
}

// Initialize ethers WebSocket provider
let provider: ethers.WebSocketProvider;
try {
  provider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
  console.log("WebSocket provider initialized");
} catch (err) {
  console.error("Failed to initialize WebSocket provider:", err);
  throw new Error("WebSocket provider initialization failed");
}

// Thresholds for whale transactions
const MIN_SWAP_USD_VALUE = 2500;
const MIN_TRANSFER_USD_VALUE = 25000;

// Cache for token prices and metadata
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const metadataCache: Record<
  string,
  { decimals: number; totalSupply: string; timestamp: number }
> = {};
const CACHE_DURATION = 60 * 1000;

// Delay for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Event signatures and ABIs
const TRANSFER_EVENT_TOPIC = ethers.id("Transfer(address,address,uint256)");
const SWAP_EVENT_TOPIC = ethers.id(
  "Swap(address,uint256,uint256,uint256,uint256,address)"
);
const erc20Abi = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Pool and stablecoin addresses
const POOLS = [
  { address: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", name: "Uniswap V3" },
  { address: "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", name: "Aerodrome" },
];
const STABLECOINS = [
  { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC" },
  { address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", symbol: "USDbC" },
];

// Fetch tokens from Firestore
async function getTokensFromFirestore(): Promise<
  Record<string, { symbol: string; address: string; name: string; pool: string }>
> {
  try {
    console.log("Fetching tokens from Firestore...");
    const { adminDb: getAdminDb } = await import("@/lib/firebase-admin");
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error("Firestore (adminDb) is not initialized");
    }
    const tokensSnapshot = await adminDb.collection("tokens").get();
    const tokens: Record<
      string,
      { symbol: string; address: string; name: string; pool: string }
    > = {};
    tokensSnapshot.forEach((doc: DocumentData) => {
      const data = doc.data();
      if (
        data &&
        data.symbol &&
        data.address &&
        /^0x[a-fA-F0-9]{40}$/.test(data.address)
      ) {
        tokens[data.address.toLowerCase()] = {
          symbol: data.symbol,
          address: data.address,
          name: data.name || data.symbol,
          pool: data.pool || "",
        };
      }
    });
    console.log(
      `Fetched ${Object.keys(tokens).length} tokens from Firestore:`,
      Object.keys(tokens)
    );
    return tokens;
  } catch (err) {
    console.error("Failed to fetch tokens from Firestore:", err);
    return {};
  }
}

// Fetch token price (simplified for local testing)
async function getTokenPrice(tokenAddress: string): Promise<number> {
  const cached = priceCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached price for ${tokenAddress}: $${cached.price}`);
    return cached.price;
  }

  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const endpoint = `http://localhost:3000/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`Tokens API error: ${res.statusText}`);
      const data = await res.json();
      const tokenPair = data.find(
        (pair: any) =>
          pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      const price = parseFloat(tokenPair?.priceUsd) || 0;
      if (price === 0)
        throw new Error(`No valid price found for ${tokenAddress}`);
      priceCache[tokenAddress.toLowerCase()] = {
        price,
        timestamp: Date.now(),
      };
      console.log(`Fetched price for ${tokenAddress}: $${price}`);
      return price;
    } catch (err: any) {
      retries++;
      console.log(
        `Retry ${retries}/${maxRetries} for price ${tokenAddress}:`,
        err.message
      );
      if (retries < maxRetries) await delay(2000 * retries);
      else {
        priceCache[tokenAddress.toLowerCase()] = {
          price: 0,
          timestamp: Date.now(),
        };
        console.error(`Failed to fetch price for ${tokenAddress}:`, err.message);
        return 0;
      }
    }
  }
  return 0;
}

// Fetch token metadata
async function getTokenMetadata(tokenAddress: string): Promise<{
  decimals: number;
  totalSupply: string;
}> {
  const cached = metadataCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached metadata for ${tokenAddress}`);
    return cached;
  }

  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      const [decimals, totalSupply] = await Promise.all([
        contract.decimals(),
        contract.totalSupply(),
      ]);
      const result = {
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
      };
      metadataCache[tokenAddress.toLowerCase()] = {
        ...result,
        timestamp: Date.now(),
      };
      console.log(`Fetched metadata for ${tokenAddress}:`, result);
      return result;
    } catch (err: any) {
      retries++;
      console.log(
        `Retry ${retries}/${maxRetries} for metadata ${tokenAddress}:`,
        err.message
      );
      if (retries < maxRetries) await delay(2000 * retries);
      else {
        const fallback = { decimals: 18, totalSupply: "0" };
        metadataCache[tokenAddress.toLowerCase()] = {
          ...fallback,
          timestamp: Date.now(),
        };
        console.error(
          `Failed to fetch metadata for ${tokenAddress}:`,
          err.message
        );
        return fallback;
      }
    }
  }
  return { decimals: 18, totalSupply: "0" };
}

// Determine transaction type
function determineTransactionType(
  from: string,
  to: string,
  tokenAddress: string
): "Buy" | "Sell" | "Transfer" {
  const exchangeAddresses = POOLS.map((pool) => pool.address.toLowerCase());
  const stablecoinAddresses = STABLECOINS.map((coin) =>
    coin.address.toLowerCase()
  );

  if (
    exchangeAddresses.includes(to.toLowerCase()) ||
    stablecoinAddresses.includes(to.toLowerCase())
  ) {
    return "Sell";
  }
  if (
    exchangeAddresses.includes(from.toLowerCase()) ||
    stablecoinAddresses.includes(from.toLowerCase())
  ) {
    return "Buy";
  }
  return "Transfer";
}

// Monitor whale transactions via blocks
async function monitorWhaleTransactions() {
  try {
    console.log("Starting monitorWhaleTransactions...");

    const { adminDb: getAdminDb } = await import("@/lib/firebase-admin");
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error("Firebase Admin Firestore (adminDb) is not initialized");
    }

    console.log("Testing Firestore connectivity...");
    await adminDb
      .collection("test")
      .doc("whale-test")
      .set({ timestamp: admin.firestore.Timestamp.fromDate(new Date()) });
    console.log("Firestore connectivity test successful");

    const tokenMapping = await getTokensFromFirestore();
    if (Object.keys(tokenMapping).length === 0) {
      console.log("No tokens found in Firestore");
      return;
    }
    console.log("Monitoring tokens:", Object.keys(tokenMapping));

    provider.on("block", async (blockNumber: number) => {
      try {
        console.log(`New block: ${blockNumber}`);
        const block = await provider.getBlock(blockNumber, true);
        if (!block || !block.transactions) {
          console.log(`Block ${blockNumber} has no transactions`);
          return;
        }

        console.log(
          `Block ${blockNumber} has ${block.transactions.length} transactions`
        );
        for (const txHash of block.transactions) {
          try {
            console.log(`Processing transaction: ${txHash}`);
            const tx = await provider.getTransactionReceipt(txHash);
            if (!tx || !tx.logs) {
              console.log(`Transaction ${txHash} has no logs`);
              continue;
            }

            for (const log of tx.logs) {
              const { address, topics, data } = log;
              console.log(`Processing log for address ${address}`);

              if (topics[0] === TRANSFER_EVENT_TOPIC) {
                const token = Object.values(tokenMapping).find(
                  (t) => t.address.toLowerCase() === address.toLowerCase()
                );
                if (!token) {
                  console.log(`No token found for address ${address}`);
                  continue;
                }

                const [from, to, value] = [
                  ethers.getAddress(`0x${topics[1].slice(26)}`),
                  ethers.getAddress(`0x${topics[2].slice(26)}`),
                  BigInt(data).toString(),
                ];

                const { decimals, totalSupply } = await getTokenMetadata(
                  token.address
                );
                const price = await getTokenPrice(token.address);
                const amountToken = Number(ethers.formatUnits(value, decimals));
                const amountUSD = amountToken * price;
                const percentSupply =
                  totalSupply !== "0"
                    ? (Number(value) / Number(totalSupply)) * 100
                    : 0;

                if (price === 0 || amountUSD < MIN_TRANSFER_USD_VALUE) {
                  console.log(
                    `Skipping Transfer ${tx.hash}: $${amountUSD.toFixed(2)} (below threshold)`
                  );
                  continue;
                }

                const txType = determineTransactionType(
                  from,
                  to,
                  token.address
                );
                const txData = {
                  tokenSymbol: token.symbol,
                  tokenName: token.name,
                  tokenAddress: token.address,
                  amountToken,
                  amountUSD,
                  blockNumber,
                  fromAddress: from,
                  toAddress: to,
                  source: "Base",
                  timestamp: admin.firestore.Timestamp.fromDate(new Date()),
                  hash: tx.hash,
                  eventType: txType,
                  percentSupply,
                  createdAt: admin.firestore.Timestamp.now(),
                };

                const existingTx = await adminDb
                  .collection("whaleTransactions")
                  .where("hash", "==", txData.hash)
                  .get();
                if (!existingTx.empty) {
                  console.log(`Skipping duplicate Transfer: ${txData.hash}`);
                  continue;
                }

                console.log("Storing Transfer:", txData);
                await adminDb.collection("whaleTransactions").add(txData);
                console.log(`Stored Transfer: ${txData.hash}`);
              } else if (
                topics[0] === SWAP_EVENT_TOPIC &&
                POOLS.some(
                  (pool) => pool.address.toLowerCase() === address.toLowerCase()
                )
              ) {
                const pool = POOLS.find(
                  (p) => pool.address.toLowerCase() === address.toLowerCase()
                );
                if (!pool) {
                  console.log(`No pool found for address ${address}`);
                  continue;
                }

                const [sender, to] = [
                  ethers.getAddress(`0x${topics[1].slice(26)}`),
                  ethers.getAddress(`0x${topics[2].slice(26)}`),
                ];
                const [amount0In, amount1In, amount0Out, amount1Out] =
                  ethers.AbiCoder.defaultAbiCoder().decode(
                    ["uint256", "uint256", "uint256", "uint256"],
                    data
                  );

                const token = Object.values(tokenMapping).find(
                  (t) => t.pool.toLowerCase() === pool.address.toLowerCase()
                );
                if (!token) {
                  console.log(`No token found for pool ${pool.address}`);
                  continue;
                }

                const { decimals, totalSupply } = await getTokenMetadata(
                  token.address
                );
                const price = await getTokenPrice(token.address);

                const isTokenIn = amount0In > 0;
                const amount = isTokenIn ? amount0In : amount0Out;
                const amountToken = Number(ethers.formatUnits(amount, decimals));
                const amountUSD = amountToken * price;
                const percentSupply =
                  totalSupply !== "0"
                    ? (Number(amount) / Number(totalSupply)) * 100
                    : 0;

                if (price === 0 || amountUSD < MIN_SWAP_USD_VALUE) {
                  console.log(
                    `Skipping Swap ${tx.hash}: $${amountUSD.toFixed(2)} (below threshold)`
                  );
                  continue;
                }

                const stablecoin =
                  STABLECOINS.find(
                    (s) => s.address.toLowerCase() !== token.address.toLowerCase()
                  ) || STABLECOINS[0];
                const swapDetails = {
                  amountIn: Number(
                    ethers.formatUnits(
                      isTokenIn ? amount0In : amount1In,
                      isTokenIn ? decimals : 6
                    )
                  ),
                  amountOut: Number(
                    ethers.formatUnits(
                      isTokenIn ? amount1Out : amount0Out,
                      isTokenIn ? 6 : decimals
                    )
                  ),
                  tokenIn: isTokenIn ? token.symbol : stablecoin.symbol,
                  tokenOut: isTokenIn ? stablecoin.symbol : token.symbol,
                };

                const txType = isTokenIn ? "Buy" : "Sell";
                const txData = {
                  tokenSymbol: token.symbol,
                  tokenName: token.name,
                  tokenAddress: token.address,
                  amountToken,
                  amountUSD,
                  blockNumber,
                  fromAddress: sender,
                  toAddress: to,
                  source: pool.name,
                  timestamp: admin.firestore.Timestamp.fromDate(new Date()),
                  hash: tx.hash,
                  eventType: "Swap",
                  swapDetails,
                  percentSupply,
                  createdAt: admin.firestore.Timestamp.now(),
                };

                const existingTx = await adminDb
                  .collection("whaleTransactions")
                  .where("hash", "==", txData.hash)
                  .get();
                if (!existingTx.empty) {
                  console.log(`Skipping duplicate Swap: ${txData.hash}`);
                  continue;
                }

                console.log("Storing Swap:", txData);
                await adminDb.collection("whaleTransactions").add(txData);
                console.log(`Stored Swap: ${txData.hash}`);

                const notification = {
                  type: "swap",
                  message: `Whale Swap: ${token.symbol} - ${swapDetails.amountIn.toFixed(2)} ${swapDetails.tokenIn} for ${swapDetails.amountOut.toFixed(2)} ${swapDetails.tokenOut} ($${amountUSD.toFixed(2)})`,
                  userId: "system",
                  hash: txData.hash,
                  timestamp: admin.firestore.Timestamp.fromDate(new Date()),
                  createdAt: admin.firestore.Timestamp.now(),
                };
                console.log("Storing notification:", notification);
                await adminDb.collection("notifications").add(notification);
                console.log(`Stored notification for Swap: ${txData.hash}`);
              }
            }
          } catch (error: any) {
            console.error(
              `Error processing transaction ${txHash} in block ${blockNumber}:`,
              error.message
            );
          }
        }
      } catch (error: any) {
        console.error(`Error fetching block ${blockNumber}:`, error.message);
      }
    });

    provider.on("error", (err: any) => {
      console.error("WebSocket provider error:", err);
    });
  } catch (err) {
    console.error("Error in monitorWhaleTransactions:", err);
  }
}

let isMonitoring = false;

export async function POST() {
  try {
    console.log("Received POST request to start monitoring");

    const { adminDb: getAdminDb } = await import("@/lib/firebase-admin");
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error("Firebase Admin Firestore (adminDb) is not initialized");
    }

    console.log("Testing Firestore connectivity...");
    await adminDb
      .collection("test")
      .doc("whale-api-test")
      .set({ timestamp: admin.firestore.Timestamp.fromDate(new Date()) });
    console.log("Firestore connectivity test successful");

    const testTx = {
      tokenSymbol: "TEST",
      tokenName: "Test Token",
      tokenAddress: "0x1234567890abcdef1234567890abcdef12345678",
      amountToken: 1000,
      amountUSD: 5000,
      blockNumber: 123456,
      fromAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
      toAddress: "0xfedcba0987654321fedcba0987654321fedcba09",
      source: "Base",
      timestamp: admin.firestore.Timestamp.fromDate(new Date()),
      hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      eventType: "Transfer",
      percentSupply: 1.5,
      createdAt: admin.firestore.Timestamp.now(),
    };
    console.log("Writing test transaction:", testTx);
    await adminDb.collection("whaleTransactions").add(testTx);
    console.log("Test transaction written successfully");

    if (isMonitoring) {
      console.log("Monitoring already active");
      return NextResponse.json({
        success: true,
        message: "Monitoring already active",
      });
    }

    isMonitoring = true;
    monitorWhaleTransactions();
    console.log("Monitoring started");
    return NextResponse.json({
      success: true,
      message: "Monitoring started for Transfer and Swap events",
    });
  } catch (error: any) {
    console.error("Error in POST handler:", {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to start monitoring", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  console.log("Received GET request to /api/whale-watchers");
  return NextResponse.json(
    { error: "GET method is not supported. Use POST to start monitoring." },
    { status: 405 }
  );
}