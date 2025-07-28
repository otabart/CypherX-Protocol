import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { type DocumentData } from "firebase-admin/firestore";
import admin from "firebase-admin";

// Environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_HTTP_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/v1/base";
const COINGECKO_API = "https://api.coingecko.com/api/v3";

if (!ALCHEMY_API_KEY) {
  console.error("ALCHEMY_API_KEY is not set");
  throw new Error("ALCHEMY_API_KEY is not set in environment variables");
}

// Initialize ethers provider
const provider = new ethers.JsonRpcProvider(ALCHEMY_HTTP_URL);

// Thresholds for whale transactions
const MIN_TRANSFER_USD_VALUE = 50000; // $50,000 for Transfers
const MIN_SWAP_USD_VALUE = 4000; // $4,000 minimum for Swaps
const MIN_PERCENT_SUPPLY = 0.05; // Minimum 0.05% of token supply
const MAX_BLOCKS_PER_CYCLE = 5;
const POLLING_INTERVAL = 30000; // 30 seconds
const MAX_FIRESTORE_RETRIES = 3;
const MAX_API_RETRIES = 5;
const RATE_LIMIT_BACKOFF_BASE = 2000; // 2 seconds base backoff

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

// Pool addresses (Uniswap V3 and Aerodrome on Base chain)
const POOLS = [
  { address: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", name: "Uniswap V3" }, // USDC/WETH pool
  { address: "0xc31a845d486d949d3ad7476ad3a76197988f2e88", name: "Aerodrome" }, // WETH/AERO pool
];

// Well-known tokens (WETH and stablecoins)
const WELL_KNOWN_TOKENS = [
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", symbol: "USDbC", name: "USD Base Coin", decimals: 6 },
];

// Interface for DexScreener API response
interface DexScreenerPair {
  pairAddress: string;
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd: string;
}

// Interface for whale transaction
interface WhaleTransaction {
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  amountToken: number;
  amountUSD: number;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  source: string;
  timestamp: number;
  hash: string;
  eventType: "Transfer" | "Swap";
  swapType?: "Buy" | "Sell" | "Swap";
  percentSupply: number;
  swapDetails?: {
    amountIn: number;
    amountOut: number;
    tokenIn: string;
    tokenOut: string;
  };
}

// Dynamic threshold for percent supply based on USD value
function getDynamicPercentSupplyThreshold(amountUSD: number): number {
  if (amountUSD >= 500000) return 0.01;
  if (amountUSD >= 100000) return 0.02;
  if (amountUSD >= 50000) return 0.03;
  if (amountUSD >= 10000) return 0.04;
  return MIN_PERCENT_SUPPLY; // 0.05% for $4,000+
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
          symbol: data.symbol,
          address: data.address.toLowerCase(),
          name: data.name || data.symbol,
          pool: data.pool || "",
        };
      }
    });
    // Add well-known tokens to ensure they’re recognized
    WELL_KNOWN_TOKENS.forEach((token) => {
      if (!tokens[token.address.toLowerCase()]) {
        tokens[token.address.toLowerCase()] = {
          symbol: token.symbol,
          address: token.address.toLowerCase(),
          name: token.name,
          pool: "",
        };
      }
    });
    console.log(`Fetched ${Object.keys(tokens).length} tokens from Firestore (including well-known tokens)`);
    return tokens;
  } catch (err) {
    console.error("Failed to fetch tokens from Firestore:", err);
    return {};
  }
}

// Fetch token price with DexScreener as primary, CoinGecko as fallback
async function getTokenPrice(tokenAddress: string): Promise<number> {
  const cached = priceCache[tokenAddress.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached price for ${tokenAddress}: $${cached.price}`);
    return cached.price;
  }

  let retries = 0;
  while (retries < MAX_API_RETRIES) {
    try {
      // Try DexScreener API
      const dexEndpoint = `${DEXSCREENER_API}/${tokenAddress}`;
      const dexRes = await fetch(dexEndpoint, { cache: "no-store" });
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const pair = dexData.pairs?.[0] as DexScreenerPair | undefined;
        const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
        if (price > 0) {
          priceCache[tokenAddress.toLowerCase()] = {
            price,
            timestamp: Date.now(),
          };
          console.log(`Fetched price from DexScreener for ${tokenAddress}: $${price}`);
          return price;
        }
        console.warn(`No valid price from DexScreener for ${tokenAddress}`);
      } else {
        console.warn(`DexScreener API returned status ${dexRes.status} for ${tokenAddress}`);
      }

      // Fallback to CoinGecko
      const coingeckoRes = await fetch(
        `${COINGECKO_API}/simple/token_price/base?contract_addresses=${encodeURIComponent(tokenAddress)}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      if (!coingeckoRes.ok) {
        console.warn(`CoinGecko API returned status ${coingeckoRes.status} for ${tokenAddress}`);
        if (coingeckoRes.status === 429) {
          throw new Error("CoinGecko API rate limit exceeded");
        }
        throw new Error(`CoinGecko API error: ${coingeckoRes.statusText}`);
      }
      const coingeckoData = await coingeckoRes.json();
      const price = coingeckoData[tokenAddress.toLowerCase()]?.usd || 0;
      if (price === 0) {
        console.warn(`No valid price found for ${tokenAddress} on CoinGecko`);
        throw new Error(`No valid price found for ${tokenAddress}`);
      }

      priceCache[tokenAddress.toLowerCase()] = {
        price,
        timestamp: Date.now(),
      };
      console.log(`Fetched price from CoinGecko for ${tokenAddress}: $${price}`);
      return price;
    } catch (error) {
      console.error(`Price fetch attempt ${retries + 1} failed for ${tokenAddress}:`, error);
      retries++;
      if (retries === MAX_API_RETRIES) {
        console.error(`Max retries reached for ${tokenAddress}. Returning price 0.`);
        return 0;
      }
      // Exponential backoff with jitter
      const backoff = RATE_LIMIT_BACKOFF_BASE * Math.pow(2, retries) + Math.random() * 100;
      await delay(backoff);
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

  // Check for well-known tokens first
  const wellKnownToken = WELL_KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (wellKnownToken) {
    const metadata = {
      decimals: wellKnownToken.decimals,
      totalSupply: "1000000000000000000000000000", // Default large supply for WETH/stablecoins
      timestamp: Date.now(),
    };
    metadataCache[tokenAddress.toLowerCase()] = metadata;
    console.log(`Using well-known metadata for ${tokenAddress}:`, metadata);
    return metadata;
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
async function saveTransaction(tx: WhaleTransaction) {
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
  const token = tokens[tokenAddress];
  if (!token) {
    console.log(`Skipping transfer for token ${tokenAddress} not in Firestore`);
    return;
  }

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
    const percentSupply = Number(metadata.totalSupply) > 0
      ? (Number(value) / Number(metadata.totalSupply)) * 100
      : 0;

    const percentSupplyThreshold = getDynamicPercentSupplyThreshold(amountUSD);
    if (
      amountUSD < MIN_TRANSFER_USD_VALUE ||
      percentSupply < percentSupplyThreshold ||
      Number.isNaN(amountUSD) ||
      Number.isNaN(percentSupply)
    ) {
      console.log(
        `Transfer of ${amount} ${token.symbol} ($${amountUSD.toFixed(2)}, ${percentSupply.toFixed(2)}%) does not meet thresholds (${
          MIN_TRANSFER_USD_VALUE
        }, ${percentSupplyThreshold}%)`
      );
      return;
    }

    const tx: WhaleTransaction = {
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

    console.log(`Processing Transfer: ${amount} ${token.symbol} ($${amountUSD.toFixed(2)}, ${percentSupply.toFixed(2)}%)`);
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
  if (source === "Unknown") {
    console.log(`Skipping swap for unknown pool ${poolAddress}`);
    return;
  }

  try {
    const contract = new ethers.Contract(poolAddress, poolAbi, provider);
    const [token0, token1] = await Promise.all([contract.token0(), contract.token1()]);
    const token0Address = token0.toLowerCase();
    const token1Address = token1.toLowerCase();

    const tokenInAddress = tokens[token0Address] ? token0Address : token1Address;
    const tokenOutAddress = tokens[token0Address] ? token1Address : token0Address;

    if (!tokens[tokenInAddress] && !tokens[tokenOutAddress]) {
      console.log(`Skipping swap: neither ${token0Address} nor ${token1Address} in Firestore`);
      return;
    }

    const iface = new ethers.Interface([
      "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
    ]);
    const parsed = iface.parseLog(log);
    if (!parsed) {
      console.error(`Failed to parse Swap log for ${poolAddress}`);
      return;
    }

    const { sender, recipient, amount0, amount1 } = parsed.args;
    const isToken0In = amount0 > 0;
    const tokenInAddr = isToken0In ? token1Address : token0Address;
    const tokenOutAddr = isToken0In ? token0Address : token1Address;

    const tokenIn = tokens[tokenInAddr] || {
      symbol: WELL_KNOWN_TOKENS.find((t) => t.address.toLowerCase() === tokenInAddr)?.symbol || "UNKNOWN",
      address: tokenInAddr,
      name: WELL_KNOWN_TOKENS.find((t) => t.address.toLowerCase() === tokenInAddr)?.name || "Unknown Token",
      pool: "",
    };
    const tokenOut = tokens[tokenOutAddr] || {
      symbol: WELL_KNOWN_TOKENS.find((t) => t.address.toLowerCase() === tokenOutAddr)?.symbol || "UNKNOWN",
      address: tokenOutAddr,
      name: WELL_KNOWN_TOKENS.find((t) => t.address.toLowerCase() === tokenOutAddr)?.name || "Unknown Token",
      pool: "",
    };

    const metadataIn = await getTokenMetadata(tokenInAddr);
    const metadataOut = await getTokenMetadata(tokenOutAddr);
    const amountIn = Number(ethers.formatUnits(isToken0In ? amount1 : amount0, metadataIn.decimals));
    const amountOut = Number(ethers.formatUnits(isToken0In ? amount0 : amount1, metadataOut.decimals));

    const priceIn = await getTokenPrice(tokenInAddr);
    const priceOut = await getTokenPrice(tokenOutAddr);
    const amountInUSD = amountIn * priceIn;
    const amountOutUSD = amountOut * priceOut;
    const amountUSD = Math.max(amountInUSD, amountOutUSD);

    const percentSupplyIn = Number(metadataIn.totalSupply) > 0
      ? (amountIn / Number(metadataIn.totalSupply)) * 100
      : 0;
    const percentSupplyOut = Number(metadataOut.totalSupply) > 0
      ? (amountOut / Number(metadataOut.totalSupply)) * 100
      : 0;

    const percentSupplyThreshold = getDynamicPercentSupplyThreshold(amountUSD);
    if (
      amountUSD < MIN_SWAP_USD_VALUE ||
      (percentSupplyIn < percentSupplyThreshold && percentSupplyOut < percentSupplyThreshold) ||
      Number.isNaN(amountUSD)
    ) {
      console.log(
        `Swap of ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol} ($${amountUSD.toFixed(2)}) does not meet thresholds`
      );
      return;
    }

    let swapType: "Buy" | "Sell" | "Swap";
    const stablecoinSymbols = WELL_KNOWN_TOKENS.map((t) => t.symbol);
    if (stablecoinSymbols.includes(tokenIn.symbol)) {
      swapType = "Buy";
    } else if (stablecoinSymbols.includes(tokenOut.symbol)) {
      swapType = "Sell";
    } else {
      swapType = "Swap";
    }

    const primaryToken = tokens[tokenOutAddr] ? tokenOut : tokenIn;
    const primaryPercentSupply = tokens[tokenOutAddr] ? percentSupplyOut : percentSupplyIn;

    const tx: WhaleTransaction = {
      tokenSymbol: primaryToken.symbol,
      tokenName: primaryToken.name,
      tokenAddress: primaryToken.address,
      amountToken: tokens[tokenOutAddr] ? amountOut : amountIn,
      amountUSD,
      blockNumber,
      fromAddress: sender,
      toAddress: recipient,
      source,
      timestamp: Date.now(),
      hash: log.transactionHash,
      eventType: "Swap",
      swapType,
      swapDetails: {
        amountIn,
        amountOut,
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
      },
      percentSupply: primaryPercentSupply,
    };

    console.log(
      `Processing ${swapType}: ${amountIn} ${tokenIn.symbol} -> ${amountOut} ${tokenOut.symbol} ($${amountUSD.toFixed(2)}, ${primaryPercentSupply.toFixed(2)}%) on ${source}`
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

  await poll();
  const intervalId = setInterval(poll, POLLING_INTERVAL);
  console.log(`Started polling every ${POLLING_INTERVAL / 1000} seconds`);

  provider.on("error", (err) => {
    console.error("Provider error:", err);
  });

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
