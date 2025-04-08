import { ethers } from "ethers";
import { tokenMapping, coinGeckoMapping } from "../app/tokenMapping.js";
import axios from "axios";
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// Debug: Verify ethers is imported
console.log("ethers imported:", typeof ethers !== "undefined" ? "Yes" : "No");

// Thresholds (aligned with API route for consistency)
const MIN_USD_VALUE = 5000; // $5000 USD
const MIN_PERCENT_SUPPLY = 0.2; // 0.2% of supply

// Cache for token prices (symbol -> price in USD)
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Delay function for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const coinGeckoId = coinGeckoMapping[tokenSymbol] || tokenSymbol.toLowerCase();

  // Check cache first
  const cached = priceCache[tokenSymbol];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached price for ${tokenSymbol}: $${cached.price}`);
    return cached.price;
  }

  // Retry logic for rate limiting
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`
      );
      const price = response.data[coinGeckoId]?.usd || 0;
      if (price === 0) {
        console.warn(`Price for ${tokenSymbol} is 0, using fallback.`);
      }
      // Cache the price
      priceCache[tokenSymbol] = { price, timestamp: Date.now() };
      console.log(`Fetched price for ${tokenSymbol}: $${price}`);
      return price;
    } catch (err: any) {
      if (err.response?.status === 429) {
        retries++;
        console.log(
          `Rate limit hit for ${tokenSymbol}. Retrying (${retries}/${maxRetries}) after delay...`
        );
        await delay(5000 * retries); // Exponential backoff: 5s, 10s, 15s
      } else {
        console.error(`❌ Failed to fetch price for ${tokenSymbol}:`, err.message);
        break;
      }
    }
  }

  // Fallback price if all retries fail
  console.log(`Using fallback price for ${tokenSymbol}: $1`);
  priceCache[tokenSymbol] = { price: 1, timestamp: Date.now() };
  return 1; // Fallback to $1 per token
}

let isMonitoringStarted = false;

export async function startTokenMonitoring() {
  if (isMonitoringStarted) {
    console.log("Token monitoring already running.");
    return;
  }

  isMonitoringStarted = true;
  console.log("🐋 Whale Watcher (ethers.js) starting...");

  try {
    // Use a WebSocket provider (e.g., Alchemy for Base)
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY is not set in environment variables.");
    }
    const providerUrl = `wss://base-mainnet.g.alchemy.com/v2/${apiKey}`;
    console.log("Connecting to provider:", providerUrl);
    const provider = new ethers.WebSocketProvider(providerUrl);

    const tokenData: Record<string, { totalSupply: number; decimals: number; symbol: string }> = {};

    const erc20Abi = [
      "function totalSupply() view returns (uint256)",
      "function decimals() view returns (uint8)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
    ];

    for (const [symbol, address] of Object.entries(tokenMapping)) {
      try {
        const contract = new ethers.Contract(address as string, erc20Abi, provider);
        const [supplyBN, decimalsBN] = await Promise.all([
          contract.totalSupply(),
          contract.decimals(),
        ]);
        const decimals = Number(decimalsBN);
        const totalSupply = parseFloat(ethers.formatUnits(supplyBN, decimals));
        tokenData[(address as string).toLowerCase()] = {
          totalSupply,
          decimals,
          symbol,
        };
        console.log(`Total supply for ${symbol} (${address}): ${totalSupply} tokens`);

        contract.on(
          "Transfer",
          async (from: string, to: string, value: bigint) => {
            try {
              const addressLower = (address as string).toLowerCase();
              if (!tokenData[addressLower]) {
                console.error(`Token data not found for address ${address}`);
                return;
              }

              const decimals = tokenData[addressLower].decimals;
              const totalSupply = tokenData[addressLower].totalSupply;
              const tokenSymbolLocal = tokenData[addressLower].symbol;

              const tokenAmount = parseFloat(
                ethers.formatUnits(value, decimals)
              );

              // Skip transactions with zero or invalid amounts
              if (tokenAmount <= 0 || isNaN(tokenAmount)) {
                console.log(
                  `Skipping invalid transaction for ${tokenSymbolLocal} (${address}): ${tokenAmount} tokens`
                );
                return;
              }

              const pctOfSupply = (tokenAmount / totalSupply) * 100;
              const price = await getTokenPrice(tokenSymbolLocal);
              const amountUSD = tokenAmount * price;

              console.log(
                `Transfer event for ${tokenSymbolLocal} (${address}): ${tokenAmount} tokens ($${amountUSD.toFixed(
                  2
                )}, ${pctOfSupply.toFixed(3)}% of supply)`
              );

              if (amountUSD >= MIN_USD_VALUE && pctOfSupply >= MIN_PERCENT_SUPPLY) {
                const whaleTx = {
                  tokenSymbol: tokenSymbolLocal,
                  tokenName: tokenSymbolLocal,
                  tokenAddress: address,
                  amountToken: tokenAmount,
                  amountUSD,
                  percentSupply: pctOfSupply,
                  fromAddress: from,
                  toAddress: to,
                  source: "ethers.js",
                  timestamp: Date.now(),
                };

                await addDoc(collection(db, "whaleTransactions"), whaleTx);
                console.log(`✅ Saved whale tx for ${tokenSymbolLocal}:`, whaleTx);
              } else {
                console.log(
                  `Transaction for ${tokenSymbolLocal} did not meet thresholds: $${amountUSD.toFixed(2)} (min: $${MIN_USD_VALUE}), ${pctOfSupply.toFixed(3)}% (min: ${MIN_PERCENT_SUPPLY}%)`
                );
              }
            } catch (err) {
              console.error(
                `❌ Transfer handler error for ${symbol} (${address}):`,
                err
              );
            }
          }
        );

        console.log(`🔗 Listening for transfers of ${symbol} at ${address}`);
      } catch (err) {
        console.error(`❌ Error setting up ${symbol} (${address}):`, err);
      }
    }

    console.log(
      "🚀 Token monitoring is now listening for Transfer events."
    );

    // Use provider.on for WebSocket events
    provider.on("error", (err: any) => {
      console.error("WebSocket error:", err);
      isMonitoringStarted = false;
    });

    provider.on("close", () => {
      console.log("WebSocket closed. Attempting to reconnect...");
      isMonitoringStarted = false;
      setTimeout(startTokenMonitoring, 5000);
    });
  } catch (err) {
    console.error("❌ Error in startTokenMonitoring:", err);
    isMonitoringStarted = false;
    throw err;
  }
}