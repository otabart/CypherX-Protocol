import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const adminDb = getFirestore(app);

// Environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_WS_URL =
  process.env.ALCHEMY_WS_URL ||
  `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

if (!ALCHEMY_API_KEY) {
  throw new Error("ALCHEMY_API_KEY is not set in environment variables");
}

// Initialize ethers WebSocket provider
let provider: ethers.WebSocketProvider;
try {
  provider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
  provider.on("open", () => console.log("WebSocket provider connected"));
  provider.on("error", (err) => console.error("WebSocket provider error:", err));
} catch (err) {
  console.error("Failed to initialize WebSocket provider:", err);
  throw new Error("WebSocket provider initialization failed");
}

// Thresholds for whale transactions
const MIN_SWAP_USD_VALUE = 2500; // $2,500 for Swap events
const MIN_TRANSFER_USD_VALUE = 25000; // $25,000 for Transfer events

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
const TRANSFER_EVENT_SIGNATURE = "Transfer(address,address,uint256)";
const SWAP_EVENT_SIGNATURE = "Swap(address,uint256,uint256,uint256,uint256,address)";
const transferAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const swapAbi = [
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
];
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

// Fetch tokens from Firestore 'tokens' collection
async function getTokensFromFirestore(): Promise<
  Record<string, { symbol: string; address: string; name: string }>
> {
  try {
    console.log("Fetching tokens from Firestore...");
    const tokensSnapshot = await getDocs(collection(adminDb, "tokens"));
    const tokens: Record<string, { symbol: string; address: string; name: string }> = {};
    tokensSnapshot.forEach((doc) => {
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
        };
      }
    });
    console.log(
      `Fetched ${Object.keys(tokens).length} valid tokens from Firestore:`,
      Object.keys(tokens)
    );
    return tokens;
  } catch (err) {
    console.error("Failed to fetch tokens from Firestore:", err);
    return {};
  }
}

// Fetch token price from /api/tokens (DexScreener)
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
      if (!res.ok) {
        throw new Error(`Tokens API error: ${res.statusText}`);
      }
      const data = await res.json();
      console.log(
        `Raw /api/tokens data for ${tokenAddress}:`,
        JSON.stringify(data, null, 2)
      );

      const tokenPair = data.find(
        (pair: any) =>
          pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      const price = parseFloat(tokenPair?.priceUsd) || 0;
      if (price === 0) {
        throw new Error(`No valid price found for ${tokenAddress}`);
      }
      priceCache[tokenAddress.toLowerCase()] = { price, timestamp: Date.now() };
      console.log(`Fetched price for ${tokenAddress}: $${price}`);
      return price;
    } catch (err: any) {
      retries++;
      console.log(
        `Error fetching price for ${tokenAddress}. Retrying (${retries}/${maxRetries})...`,
        err.message
      );
      if (retries < maxRetries) {
        await delay(2000 * retries);
      } else {
        console.error(`Failed to fetch price for ${tokenAddress}:`, err.message);
        priceCache[tokenAddress.toLowerCase()] = {
          price: 0,
          timestamp: Date.now(),
        };
        return 0;
      }
    }
  }
  return 0;
}

// Fetch token metadata using ethers
async function getTokenMetadata(tokenAddress: string): Promise<{
  decimals: number;
  totalSupply: string;
}> {
  const cached = metadataCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached metadata for ${tokenAddress}:`, cached);
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
        `Retry ${retries}/${maxRetries} for metadata ${tokenAddress} due to:`,
        err.message
      );
      if (retries < maxRetries) {
        await delay(2000 * retries);
      } else {
        console.error(`Failed to fetch metadata for ${tokenAddress}:`, err.message);
        const fallback = { decimals: 18, totalSupply: "0" };
        metadataCache[tokenAddress.toLowerCase()] = {
          ...fallback,
          timestamp: Date.now(),
        };
        return fallback;
      }
    }
  }
  return { decimals: 18, totalSupply: "0" };
}

// Monitor whale transfers and swaps
async function monitorWhaleEvents() {
  try {
    console.log("Starting monitorWhaleEvents...");

    // Test Firestore connectivity
    console.log("Testing Firestore connectivity...");
    const testSnapshot = await getDocs(collection(adminDb, "whaleTransactions"));
    console.log("Firestore test successful, found documents:", testSnapshot.size);

    // Fetch tokens
    const tokenMapping = await getTokensFromFirestore();
    if (Object.keys(tokenMapping).length === 0) {
      console.log("No tokens found in Firestore");
      return;
    }
    console.log("Monitoring tokens:", Object.keys(tokenMapping));

    // Monitor Transfer events
    for (const token of Object.values(tokenMapping)) {
      try {
        const contract = new ethers.Contract(token.address, transferAbi, provider);
        console.log(`Setting up Transfer listener for ${token.symbol} (${token.address})`);
        contract.on(
          TRANSFER_EVENT_SIGNATURE,
          async (from, to, value, event) => {
            try {
              console.log(
                `Detected Transfer event: ${token.symbol} from ${from} to ${to}, value: ${value.toString()}, tx: ${event.log.transactionHash}`
              );

              // Fetch metadata and price
              const { decimals, totalSupply } = await getTokenMetadata(token.address);
              const price = await getTokenPrice(token.address);
              const amountToken = Number(ethers.formatUnits(value, decimals));
              const amountUSD = amountToken * price;
              const percentage =
                totalSupply !== "0" ? (Number(value) / Number(totalSupply)) * 100 : 0;

              if (price === 0 || amountUSD < MIN_TRANSFER_USD_VALUE) {
                console.log(
                  `Skipping Transfer ${event.log.transactionHash}: $${amountUSD.toFixed(
                    2
                  )} (below $${MIN_TRANSFER_USD_VALUE} or invalid price)`
                );
                return;
              }

              const txData = {
                tokenSymbol: token.symbol,
                tokenName: token.name,
                tokenAddress: token.address,
                amountToken,
                amountUSD,
                fromAddress: from,
                toAddress: to,
                source: "Base",
                timestamp: Date.now(),
                hash: event.log.transactionHash,
                eventType: "Transfer",
                percentage,
                createdAt: serverTimestamp(),
              };

              // Check for existing transaction
              const existingTx = await getDocs(
                query(
                  collection(adminDb, "whaleTransactions"),
                  where("hash", "==", txData.hash)
                )
              );
              if (!existingTx.empty) {
                console.log(`Skipping duplicate Transfer: ${txData.hash}`);
                return;
              }

              console.log("Storing Transfer transaction:", txData);
              await addDoc(collection(adminDb, "whaleTransactions"), txData);
            } catch (error) {
              console.error(
                `Error processing Transfer event for ${token.symbol}:`,
                error
              );
            }
          }
        );
      } catch (err) {
        console.error(`Failed to set up Transfer listener for ${token.symbol}:`, err);
      }
    }

    // Monitor Swap events
    for (const pool of POOLS) {
      try {
        const contract = new ethers.Contract(pool.address, swapAbi, provider);
        console.log(`Setting up Swap listener for ${pool.name} (${pool.address})`);
        contract.on(
          SWAP_EVENT_SIGNATURE,
          async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
            try {
              console.log(
                `Detected Swap event in ${pool.name}: sender ${sender}, to ${to}, tx: ${event.log.transactionHash}`
              );

              // Simplified: Assume token0 is the token of interest (e.g., $checkr)
              const tokenAddress = Object.values(tokenMapping)[0]?.address;
              if (!tokenAddress) {
                console.log("No token address available for Swap processing");
                return;
              }

              const token = tokenMapping[tokenAddress.toLowerCase()];
              const { decimals, totalSupply } = await getTokenMetadata(tokenAddress);
              const price = await getTokenPrice(tokenAddress);

              // Determine swap direction
              const isTokenIn = amount0In > 0;
              const amount = isTokenIn ? amount0In : amount0Out;
              const amountToken = Number(ethers.formatUnits(amount, decimals));
              const amountUSD = amountToken * price;
              const percentage =
                totalSupply !== "0" ? (Number(amount) / Number(totalSupply)) * 100 : 0;

              if (price === 0 || amountUSD < MIN_SWAP_USD_VALUE) {
                console.log(
                  `Skipping Swap ${event.log.transactionHash}: $${amountUSD.toFixed(
                    2
                  )} (below $${MIN_SWAP_USD_VALUE} or invalid price)`
                );
                return;
              }

              // Assume stablecoin is token1
              const stablecoin = STABLECOINS[0];
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

              const txData = {
                tokenSymbol: token.symbol,
                tokenName: token.name,
                tokenAddress: token.address,
                amountToken,
                amountUSD,
                fromAddress: sender,
                toAddress: to,
                source: pool.name,
                timestamp: Date.now(),
                hash: event.log.transactionHash,
                eventType: "Swap",
                swapDetails,
                percentage,
                createdAt: serverTimestamp(),
              };

              // Check for existing transaction
              const existingTx = await getDocs(
                query(
                  collection(adminDb, "whaleTransactions"),
                  where("hash", "==", txData.hash)
                )
              );
              if (!existingTx.empty) {
                console.log(`Skipping duplicate Swap: ${txData.hash}`);
                return;
              }

              console.log("Storing Swap transaction:", txData);
              await addDoc(collection(adminDb, "whaleTransactions"), txData);

              // Add notification for Swap
              const notification = {
                type: "swap",
                message: `Whale Swap: ${token.symbol} - ${swapDetails.amountIn.toFixed(
                  2
                )} ${swapDetails.tokenIn} for ${swapDetails.amountOut.toFixed(
                  2
                )} ${swapDetails.tokenOut} ($${amountUSD.toFixed(2)})`,
                hash: txData.hash,
                timestamp: Date.now(),
                createdAt: serverTimestamp(),
              };
              console.log("Storing Swap notification:", notification);
              await addDoc(collection(adminDb, "notifications"), notification);
            } catch (error) {
              console.error(`Error processing Swap event for ${pool.name}:`, error);
            }
          }
        );
      } catch (err) {
        console.error(`Failed to set up Swap listener for ${pool.name}:`, err);
      }
    }
  } catch (err) {
    console.error("Error in monitorWhaleEvents:", err);
  }
}

// Monitoring state
let isMonitoring = false;

export async function POST() {
  try {
    console.log("Received POST request to start monitoring");
    if (isMonitoring) {
      console.log("Monitoring already active");
      return NextResponse.json({
        success: true,
        message: "Monitoring already active",
      });
    }

    // Test Firestore access
    console.log("Testing Firestore in POST...");
    const testDoc = await getDocs(collection(adminDb, "whaleTransactions"));
    console.log("Firestore test successful, docs found:", testDoc.size);

    isMonitoring = true;
    monitorWhaleEvents();
    console.log("Monitoring started");
    return NextResponse.json({
      success: true,
      message: "Monitoring started for Transfer and Swap events",
    });
  } catch (error: any) {
    console.error("Error in POST handler:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to start monitoring", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "GET method is not supported. Use POST to start monitoring.",
    },
    { status: 405 }
  );
}