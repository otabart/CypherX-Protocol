import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { type DocumentData } from "firebase-admin/firestore";
import admin from "firebase-admin";

// Environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_HTTP_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const COINGECKO_API = "https://api.coingecko.com/api/v3";

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY is not set");
  throw new Error("ALCHEMY_API_KEY is not set in environment variables");
}

// Initialize ethers provider
const provider = new ethers.JsonRpcProvider(ALCHEMY_HTTP_URL);

// Thresholds for whale transactions
const MIN_TRANSFER_USD_VALUE = 50000; // $50,000 for Transfers
const MIN_SWAP_USD_VALUE = 10000; // $10,000 for Swaps
const MIN_PERCENT_SUPPLY = 0.1; // Minimum 0.1% of token supply
const MAX_BLOCKS_PER_CYCLE = 5;
const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_FIRESTORE_RETRIES = 3;

// Token addresses to exclude
const EXCLUDED_TOKENS = {
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed7Bf".toLowerCase(),
};

// Cache for token prices and metadata
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const metadataCache: Record<
  string,
  { decimals: number; totalSupply: string; timestamp: number }
> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
const poolAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

// Pool and stablecoin addresses
const POOLS = [
  { address: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", name: "Uniswap V3" },
  { address: "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", name: "Aerodrome" },
  { address: "0xYOUR_ALIENBASE_POOL_ADDRESS", name: "Alienbase" }, // Replace with actual Alienbase pool address
  { address: "0xYOUR_PANCAKESWAP_POOL_ADDRESS", name: "PancakeSwap" }, // Replace with actual PancakeSwap pool address
  { address: "0xBASE_POOL_ADDRESS", name: "Base" }, // Replace with actual Base pool address if needed
];
const STABLECOINS = [
  { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC" },
  { address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", symbol: "USDbC" },
];

// Interface for token pair data from API
interface TokenPair {
  baseToken: { address: string };
  priceUsd: string;
}

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
          (pair: TokenPair) =>
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
        `${COINGECKO_API}/simple/token_price/base?contract_addresses=${encodeURIComponent(tokenAddress)}&vs_currencies=usd`,
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
    } catch (error) {
      console.error(`Price fetch attempt ${retries + 1} failed for ${tokenAddress}:`, error);
      retries++;
      if (retries === maxRetries) {
        console.error(`Max retries reached for ${tokenAddress}. Returning price 0.`);
        return 0;
      }
      await delay(1000 * retries);
    }
  }
  return 0;
}

// Fetch token metadata
async function getTokenMetadata(tokenAddress: string) {
  const cached = metadataCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached metadata for ${tokenAddress}`);
    return cached;
  }

  try {
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const [decimals, totalSupply] = await Promise.all([
      contract.decimals(),
      contract.totalSupply(),
    ]);
    const metadata = {
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
      timestamp: Date.now(),
    };
    metadataCache[tokenAddress.toLowerCase()] = metadata;
    console.log(`Fetched metadata for ${tokenAddress}:`, metadata);
    return metadata;
  } catch (err) {
    console.error(`Failed to fetch metadata for ${tokenAddress}:`, err);
    return { decimals: 18, totalSupply: "0", timestamp: Date.now() };
  }
}

// Determine pool name
function getPoolName(poolAddress: string): string {
  const pool = POOLS.find((p) => p.address.toLowerCase() === poolAddress.toLowerCase());
  return pool ? pool.name : "Unknown";
}

// Save transaction to Firestore
async function saveTransaction(tx: any) {
  const { adminDb: getAdminDb } = await import("@/lib/firebase-admin");
  const adminDb = getAdminDb();
  if (!adminDb) {
    console.error("Firestore (adminDb) is not initialized");
    return;
  }

  let retries = 0;
  while (retries < MAX_FIRESTORE_RETRIES) {
    try {
      const docRef = adminDb.collection("whaleTransactions").doc();
      await docRef.set({
        ...tx,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Saved transaction ${tx.hash} to Firestore`);
      return;
    } catch (err) {
      console.error(`Failed to save transaction ${tx.hash} (attempt ${retries + 1}):`, err);
      retries++;
      if (retries === MAX_FIRESTORE_RETRIES) {
        console.error(`Max retries reached for saving transaction ${tx.hash}`);
      }
      await delay(1000 * retries);
    }
  }
}

// Process Transfer event
async function processTransferEvent(
  log: ethers.Log,
  tokens: Record<string, { symbol: string; address: string; name: string; pool: string }>,
  blockNumber: number
) {
  const tokenAddress = log.address.toLowerCase();
  if (EXCLUDED_TOKENS.cbBTC === tokenAddress) {
    console.log(`Skipping excluded token: ${tokenAddress}`);
    return;
  }

  const token = tokens[tokenAddress] || {
    symbol: "UNKNOWN",
    address: tokenAddress,
    name: "Unknown Token",
    pool: "",
  };

  try {
    const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const parsed = iface.parseLog(log);
    if (!parsed) {
      console.error(`Failed to parse Transfer log for ${tokenAddress}`);
      return;
    }

    const { from, to, value } = parsed.args;
    const metadata = await getTokenMetadata(tokenAddress);
    const amount = Number(ethers.formatUnits(value, metadata.decimals));
    const price = await getTokenPrice(tokenAddress);
    const amountUSD = amount * price;
    const percentSupply = (Number(value) / Number(metadata.totalSupply)) * 100;

    if (
      amountUSD < MIN_TRANSFER_USD_VALUE ||
      percentSupply < MIN_PERCENT_SUPPLY ||
      Number.isNaN(amountUSD) ||
      Number.isNaN(percentSupply)
    ) {
      console.log(
        `Transfer of ${amount} ${token.symbol} ($${amountUSD.toFixed(2)}) does not meet thresholds`
      );
      return;
    }

    const tx = {
      tokenSymbol: token.symbol,
      tokenName: token.name,
      tokenAddress,
      amountToken: amount,
      amountUSD,
      blockNumber,
      fromAddress: from,
      toAddress: to,
      source: "Unknown",
      timestamp: Date.now(),
      hash: log.transactionHash,
      eventType: "Transfer",
      percentSupply,
    };

    console.log(`Processing Transfer: ${amount} ${token.symbol} ($${amountUSD.toFixed(2)})`);
    await saveTransaction(tx);
  } catch (err) {
    console.error(`Error processing Transfer event for ${tokenAddress}:`, err);
  }
}

// Process Swap event
async function processSwapEvent(
  log: ethers.Log,
  tokens: Record<string, { symbol: string; address: string; name: string; pool: string }>,
  blockNumber: number
) {
  const poolAddress = log.address.toLowerCase();
  const source = getPoolName(poolAddress);

  try {
    const contract = new ethers.Contract(poolAddress, poolAbi, provider);
    const [token0, token1] = await Promise.all([contract.token0(), contract.token1()]);
    const token0Address = token0.toLowerCase();
    const token1Address = token1.toLowerCase();

    const iface = new ethers.Interface([
      "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
    ]);
    const parsed = iface.parseLog(log);
    if (!parsed) {
      console.error(`Failed to parse Swap log for ${poolAddress}`);
      return;
    }

    const { sender, recipient, amount0, amount1 } = parsed.args;
    let tokenInAddress = amount0 > 0 ? token1Address : token0Address;
    let tokenOutAddress = amount0 > 0 ? token0Address : token1Address;
    let amountIn = Number(ethers.formatUnits(amount0 > 0 ? amount1 : amount0, 18));
    let amountOut = Number(ethers.formatUnits(amount0 > 0 ? amount0 : amount1, 18));

    const tokenIn = tokens[tokenInAddress] || {
      symbol: "UNKNOWN",
      address: tokenInAddress,
      name: "Unknown Token",
      pool: "",
    };
    const tokenOut = tokens[tokenOutAddress] || {
      symbol: "UNKNOWN",
      address: tokenOutAddress,
      name: "Unknown Token",
      pool: "",
    };

    const metadataIn = await getTokenMetadata(tokenInAddress);
    const metadataOut = await getTokenMetadata(tokenOutAddress);
    amountIn = Number(ethers.formatUnits(amount0 > 0 ? amount1 : amount0, metadataIn.decimals));
    amountOut = Number(ethers.formatUnits(amount0 > 0 ? amount0 : amount1, metadataOut.decimals));

    const priceIn = await getTokenPrice(tokenInAddress);
    const priceOut = await getTokenPrice(tokenOutAddress);
    const amountInUSD = amountIn * priceIn;
    const amountOutUSD = amountOut * priceOut;
    const amountUSD = Math.max(amountInUSD, amountOutUSD);

    const percentSupplyIn = (amountIn / Number(metadataIn.totalSupply)) * 100;
    const percentSupplyOut = (amountOut / Number(metadataOut.totalSupply)) * 100;

    if (
      amountUSD < MIN_SWAP_USD_VALUE ||
      (percentSupplyIn < MIN_PERCENT_SUPPLY && percentSupplyOut < MIN_PERCENT_SUPPLY) ||
      Number.isNaN(amountUSD)
    ) {
      console.log(
        `Swap of ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol} ($${amountUSD.toFixed(2)}) does not meet thresholds`
      );
      return;
    }

    const tx = {
      tokenSymbol: tokenOut.symbol,
      tokenName: tokenOut.name,
      tokenAddress: tokenOutAddress,
      amountToken: amountOut,
      amountUSD,
      blockNumber,
      fromAddress: sender,
      toAddress: recipient,
      source,
      timestamp: Date.now(),
      hash: log.transactionHash,
      eventType: "Swap",
      swapDetails: {
        amountIn,
        amountOut,
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
      },
      percentSupply: percentSupplyOut,
    };

    console.log(
      `Processing Swap: ${amountIn} ${tokenIn.symbol} -> ${amountOut} ${tokenOut.symbol} ($${amountUSD.toFixed(2)}) on ${source}`
    );
    await saveTransaction(tx);
  } catch (err) {
    console.error(`Error processing Swap event for ${poolAddress}:`, err);
  }
}

// Monitor blockchain events
async function monitorWhaleTransactions() {
  let isMonitoring = false;

  const processBlockRange = async (fromBlock: number, toBlock: number) => {
    if (isMonitoring) return;
    isMonitoring = true;

    try {
      console.log(`Processing blocks ${fromBlock} to ${toBlock}`);
      const tokens = await getTokensFromFirestore();
      const filter = {
        fromBlock,
        toBlock,
        topics: [[TRANSFER_EVENT_TOPIC, UNISWAP_V3_SWAP_TOPIC, AERODROME_SWAP_TOPIC]],
      };
      const logs = await provider.getLogs(filter);
      console.log(`Fetched ${logs.length} logs`);

      for (const log of logs) {
        if (log.topics[0] === TRANSFER_EVENT_TOPIC) {
          await processTransferEvent(log, tokens, log.blockNumber);
        } else if (log.topics[0] === UNISWAP_V3_SWAP_TOPIC || log.topics[0] === AERODROME_SWAP_TOPIC) {
          await processSwapEvent(log, tokens, log.blockNumber);
        }
        await delay(100); // Rate limiting
      }
    } catch (err) {
      console.error(`Error processing blocks ${fromBlock} to ${toBlock}:`, err);
    } finally {
      isMonitoring = false;
    }
  };

  const poll = async () => {
    try {
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = latestBlock - MAX_BLOCKS_PER_CYCLE + 1;
      await processBlockRange(fromBlock, latestBlock);
    } catch (err) {
      console.error("Polling error:", err);
    }
  };

  // Initial poll
  await poll();

  // Set up polling interval
  const intervalId = setInterval(poll, POLLING_INTERVAL);
  console.log(`Started polling every ${POLLING_INTERVAL / 1000} seconds`);

  // Handle provider errors
  provider.on("error", (err) => {
    console.error("Provider error:", err);
  });

  // Clean up on process exit
  process.on("SIGINT", () => {
    clearInterval(intervalId);
    console.log("Stopped polling");
    process.exit();
  });
}

// POST handler to start monitoring
export async function POST() {
  try {
    await monitorWhaleTransactions();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error starting whale transaction monitoring:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start monitoring" },
      { status: 500 }
    );
  }
}
