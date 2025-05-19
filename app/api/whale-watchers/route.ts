import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { type DocumentData } from "firebase-admin/firestore";
import admin from "firebase-admin";

// Environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_WS_URL =
  process.env.ALCHEMY_WS_URL ||
  `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY is not set");
  throw new Error("ALCHEMY_API_KEY is not set in environment variables");
}

// Initialize ethers WebSocket provider
let provider: ethers.WebSocketProvider;
function initializeProvider() {
  try {
    provider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
    console.log("WebSocket provider initialized");
    provider.on("error", (err: any) => {
      console.error("WebSocket provider error:", err);
      setTimeout(initializeProvider, 5000);
    });
    provider.on("close", () => {
      console.error("WebSocket closed, reconnecting...");
      setTimeout(initializeProvider, 5000);
    });
  } catch (err) {
    console.error("Failed to initialize WebSocket provider:", err);
    setTimeout(initializeProvider, 5000);
  }
}
initializeProvider();

// Thresholds for whale transactions
const MIN_SWAP_USD_VALUE = 10000; // $10,000 for swaps
const MIN_TRANSFER_USD_VALUE = 100000; // $100,000 for transfers

// Cache for token prices and metadata
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const metadataCache: Record<
  string,
  { decimals: number; totalSupply: string; timestamp: number }
> = {};
const CACHE_DURATION = 60 * 1000; // 1 minute

// Delay for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Event signatures and ABIs
const TRANSFER_EVENT_TOPIC = ethers.id("Transfer(address,address,uint256)");
const UNISWAP_V3_SWAP_TOPIC = ethers.id(
  "Swap(address,address,int256,int256,uint160,uint128,int24)"
);
const AERODROME_SWAP_TOPIC = ethers.id(
  "Swap(address,address,int256,int256,uint160,uint128,int24)"
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
          symbol: data.symbol || "UNKNOWN",
          address: data.address,
          name: data.name || data.symbol,
          pool: data.pool || "",
        };
      }
    });
    console.log(`Fetched ${Object.keys(tokens).length} tokens from Firestore`);
    return tokens;
  } catch (err) {
    console.error("Failed to fetch tokens from Firestore:", err);
    return {};
  }
}

// Fetch token price with CoinGecko fallback
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
      // Try local tokens API
      const endpoint = `http://localhost:3000/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const tokenPair = data.find(
          (pair: any) =>
            pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
        );
        const price = parseFloat(tokenPair?.priceUsd) || 0;
        if (price > 0) {
          priceCache[tokenAddress.toLowerCase()] = {
            price,
            timestamp: Date.now(),
          };
          console.log(`Fetched price from tokens API for ${tokenAddress}: $${price}`);
          return price;
        }
      }

      // Fallback to CoinGecko
      const coingeckoRes = await fetch(
        `${COINGECKO_API_URL}/simple/token_price/base?contract_addresses=${tokenAddress}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      if (!coingeckoRes.ok) throw new Error(`CoinGecko API error: ${coingeckoRes.statusText}`);
      const coingeckoData = await coingeckoRes.json();
      const price = coingeckoData[tokenAddress.toLowerCase()]?.usd || 0;
      if (price === 0) throw new Error(`No valid price found for ${tokenAddress}`);

      priceCache[tokenAddress.toLowerCase()] = {
        price,
        timestamp: Date.now(),
      };
      console.log(`Fetched price from CoinGecko for ${tokenAddress}: $${price}`);
      return price;
    } catch (err: any) {
      retries++;
      console.log(
        `Retry ${retries}/${maxRetries} for price ${tokenAddress}:`,
        err.message
      );
      if (retries < maxRetries) await delay(2000 * retries);
      else {
        // Fallback for stablecoins
        if (
          STABLECOINS.some(
            (s) => s.address.toLowerCase() === tokenAddress.toLowerCase()
          )
        ) {
          priceCache[tokenAddress.toLowerCase()] = {
            price: 1,
            timestamp: Date.now(),
          };
          console.log(`Using fallback price for ${tokenAddress}: $1`);
          return 1;
        }
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
    stablecoinAddresses.includes(tokenAddress.toLowerCase())
  ) {
    return "Sell";
  }
  if (
    exchangeAddresses.includes(from.toLowerCase()) ||
    stablecoinAddresses.includes(tokenAddress.toLowerCase())
  ) {
    return "Buy";
  }
  return "Transfer";
}

// Monitor whale transactions via logs
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
      console.log("No tokens found in Firestore, stopping monitoring");
      isMonitoring = false;
      return;
    }
    console.log("Monitoring tokens:", Object.keys(tokenMapping));

    provider.on("log", async (log: ethers.Log) => {
      try {
        const { address, topics, data, transactionHash, blockNumber } = log;
        console.log(`New log for address ${address}`);

        if (topics[0] === TRANSFER_EVENT_TOPIC) {
          const token = Object.values(tokenMapping).find(
            (t) => t.address.toLowerCase() === address.toLowerCase()
          );
          if (!token) {
            console.log(`No token found for address ${address}`);
            return;
          }

          const [from, to, value] = [
            ethers.getAddress(`0x${topics[1].slice(26)}`),
            ethers.getAddress(`0x${topics[2].slice(26)}`),
            BigInt(data).toString(),
          ];

          const { decimals, totalSupply } = await getTokenMetadata(token.address);
          const price = await getTokenPrice(token.address);
          const amountToken = Number(ethers.formatUnits(value, decimals));
          const amountUSD = amountToken * price;
          const percentSupply =
            totalSupply !== "0"
              ? (Number(value) / Number(totalSupply)) * 100
              : 0;

          if (price === 0 || amountUSD < MIN_TRANSFER_USD_VALUE) {
            console.log(
              `Skipping Transfer ${transactionHash}: $${amountUSD.toFixed(2)} (below threshold or no price)`
            );
            return;
          }

          const eventType = determineTransactionType(from, to, token.address);
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
            hash: transactionHash,
            eventType,
            percentSupply,
            createdAt: admin.firestore.Timestamp.now(),
          };

          const existingTx = await adminDb
            .collection("whaleTransactions")
            .where("hash", "==", txData.hash)
            .get();
          if (!existingTx.empty) {
            console.log(`Skipping duplicate Transfer: ${txData.hash}`);
            return;
          }

          console.log("Storing Transfer:", txData);
          await adminDb.collection("whaleTransactions").add(txData);
          console.log(`Stored Transfer: ${txData.hash}`);
        } else if (
          [UNISWAP_V3_SWAP_TOPIC, AERODROME_SWAP_TOPIC].includes(topics[0]) &&
          POOLS.some((pool) => pool.address.toLowerCase() === address.toLowerCase())
        ) {
          const pool = POOLS.find(
            (p) => p.address.toLowerCase() === address.toLowerCase()
          );
          if (!pool) {
            console.log(`No pool found for address ${address}`);
            return;
          }

          const [sender, recipient, amount0, amount1] = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address", "address", "int256", "int256"],
            data
          );

          const token = Object.values(tokenMapping).find(
            (t) => t.pool.toLowerCase() === pool.address.toLowerCase()
          );
          if (!token) {
            console.log(`No token found for pool ${pool.address}`);
            return;
          }

          const { decimals, totalSupply } = await getTokenMetadata(token.address);
          const price = await getTokenPrice(token.address);

          const isToken0 = amount0 > 0;
          const amount = isToken0 ? amount0 : amount1;
          const amountToken = Number(ethers.formatUnits(amount, decimals));
          const amountUSD = amountToken * price;
          const percentSupply =
            totalSupply !== "0"
              ? (Number(amount) / Number(totalSupply)) * 100
              : 0;

          if (price === 0 || amountUSD < MIN_SWAP_USD_VALUE) {
            console.log(
              `Skipping Swap ${transactionHash}: $${amountUSD.toFixed(2)} (below threshold or no price)`
            );
            return;
          }

          const stablecoin =
            STABLECOINS.find(
              (s) => s.address.toLowerCase() !== token.address.toLowerCase()
            ) || STABLECOINS[0];
          const swapDetails = {
            amountIn: Number(
              ethers.formatUnits(
                isToken0 ? amount0 : amount1,
                isToken0 ? decimals : 6
              )
            ),
            amountOut: Number(
              ethers.formatUnits(
                isToken0 ? amount1 : amount0,
                isToken0 ? 6 : decimals
              )
            ),
            tokenIn: isToken0 ? token.symbol : stablecoin.symbol,
            tokenOut: isToken0 ? stablecoin.symbol : token.symbol,
          };

          const eventType = isToken0 ? "Buy" : "Sell";
          const txData = {
            tokenSymbol: token.symbol,
            tokenName: token.name,
            tokenAddress: token.address,
            amountToken,
            amountUSD,
            blockNumber,
            fromAddress: sender,
            toAddress: recipient,
            source: pool.name,
            timestamp: admin.firestore.Timestamp.fromDate(new Date()),
            hash: transactionHash,
            eventType,
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
            return;
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
      } catch (error: any) {
        console.error(`Error processing log ${log.transactionHash}:`, error.message);
      }
    });
  } catch (err) {
    console.error("Error in monitorWhaleTransactions:", err);
    isMonitoring = false;
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

    // Add test transaction for verification
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
      hash: "0x" + "0".repeat(64),
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