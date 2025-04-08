// Import NextResponse with a type assertion to bypass the error
import { NextResponse as NextResponseType } from "next/server";
const NextResponse = NextResponseType as any; // Type assertion to bypass TypeScript error

import { ethers } from "ethers";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase.js";
import { tokenMapping, coinGeckoMapping } from "@/app/tokenMapping.js";
import axios from "axios";

// Base chain provider (Alchemy example)
const provider = new ethers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);

// Thresholds
const MIN_USD_VALUE = 5000;
const MIN_PERCENT_SUPPLY = 0.2;

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

async function getTokenSupplyAndDecimals(tokenAddress: string): Promise<{ totalSupply: number; decimals: number }> {
  const contract = new ethers.Contract(
    tokenAddress,
    [
      "function totalSupply() view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    provider
  );
  const [supply, decimals] = await Promise.all([
    contract.totalSupply(),
    contract.decimals(),
  ]);
  return {
    totalSupply: Number(ethers.formatUnits(supply, decimals)),
    decimals: Number(decimals),
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tokenAddress, amount, from, to, txHash } = payload;

    // Validate payload
    if (!tokenAddress || !amount || !from || !to || !txHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find token in mapping
    const tokenEntry = Object.entries(tokenMapping).find(
      ([_, addr]) => (addr as string).toLowerCase() === tokenAddress.toLowerCase()
    );
    if (!tokenEntry) {
      return NextResponse.json({ error: "Unsupported token" }, { status: 400 });
    }
    const [symbol] = tokenEntry;

    // Get token supply and decimals
    const { totalSupply, decimals } = await getTokenSupplyAndDecimals(tokenAddress);

    // Calculate token amount
    const amountToken = Number(ethers.formatUnits(amount, decimals));
    if (isNaN(amountToken) || amountToken <= 0) {
      return NextResponse.json({ error: "Invalid token amount" }, { status: 400 });
    }

    // Calculate USD value
    const price = await getTokenPrice(symbol);
    const amountUSD = amountToken * price;

    // Calculate % of supply
    const percentSupply = (amountToken / totalSupply) * 100;

    // Check whale criteria
    if (amountUSD >= MIN_USD_VALUE && percentSupply >= MIN_PERCENT_SUPPLY) {
      const whaleTx = {
        tokenSymbol: symbol,
        tokenName: symbol,
        tokenAddress,
        amountToken,
        amountUSD,
        percentSupply,
        fromAddress: from,
        toAddress: to,
        source: "Base",
        timestamp: Date.now(),
      };

      // Save to Firestore
      await addDoc(collection(db, "whaleTransactions"), whaleTx);
      console.log("Whale transaction saved:", whaleTx);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        {
          message: "Transaction did not meet whale criteria",
          amountUSD,
          percentSupply,
          thresholds: { MIN_USD_VALUE, MIN_PERCENT_SUPPLY },
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error("Error processing transaction:", error.message);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "GET method is not supported on this endpoint. Use POST." },
    { status: 405 }
  );
}