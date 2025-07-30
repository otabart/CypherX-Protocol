import { getCoins } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = adminDb();
    if (!db) throw new Error("Firestore adminDb is not initialized");
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    // Query only tokens created in the last 3 days
    const snapshot = await db.collection("Cypherscope")
      .where("createdAt", ">=", new Date(threeDaysAgo))
      .get();

    const tokenAddresses: string[] = snapshot.docs
      .map(doc => doc.data()?.address)
      .filter(addr => typeof addr === "string" && addr.length === 42);

    if (tokenAddresses.length === 0) {
      return new Response(JSON.stringify({ tokens: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch from Zora SDK
    const zoraResponse = await getCoins({
      coins: tokenAddresses.map(address => ({
        collectionAddress: address,
        chainId: base.id,
      })),
    });
    const zoraTokens = (zoraResponse.data?.zora20Tokens || []).filter(Boolean);
    const zoraAddresses = new Set(zoraTokens.map(token => token.address?.toLowerCase()));

    // Create fallback tokens for addresses not found in Zora
    const fallbackTokens: Array<{
      __typename: string;
      id: string;
      name: string;
      symbol: string;
      address: string;
      totalSupply: string;
      totalVolume: string;
      volume24h: string;
      createdAt: string;
      creatorAddress: string;
      creatorEarnings: Array<{
        amount?: string;
        currency?: string;
        recipient?: string;
      }>;
      poolCurrencyToken: {
        address: string;
        name: string;
        decimals: number;
      };
      tokenPrice: {
        priceInUsdc: string;
        currencyAddress: string;
        priceInPoolToken: string;
      };
      marketCap: string;
      marketCapDelta24h: string;
      chainId: number;
      tokenUri: string;
      platformReferrerAddress: string;
      payoutRecipientAddress: string;
      creatorProfile: null;
      mediaContent: null;
      uniqueHolders: string;
      uniswapV3PoolAddress: null;
      zoraComments: null;
      isFallbackToken: boolean;
    }> = [];
    const remainingAddresses = tokenAddresses.filter(addr => !zoraAddresses.has(addr.toLowerCase()));

    for (const address of remainingAddresses) {
      // Create a fallback token object for addresses not found in Zora
      const fallbackToken = {
        __typename: "FallbackToken",
        id: `fallback-${address}`,
        name: "Unknown Token",
        symbol: "UNKNOWN",
        address: address,
        totalSupply: "0",
        totalVolume: "0",
        volume24h: "0",
        createdAt: new Date().toISOString(),
        creatorAddress: "0x0000000000000000000000000000000000000000",
        creatorEarnings: [],
        poolCurrencyToken: {
          address: "0x4200000000000000000000000000000000000006",
          name: "WETH",
          decimals: 18
        },
        tokenPrice: {
          priceInUsdc: "0",
          currencyAddress: address,
          priceInPoolToken: "0"
        },
        marketCap: "0",
        marketCapDelta24h: "0",
        chainId: 8453,
        tokenUri: "",
        platformReferrerAddress: "0x0000000000000000000000000000000000000000",
        payoutRecipientAddress: "0x0000000000000000000000000000000000000000",
        creatorProfile: null,
        mediaContent: null,
        uniqueHolders: "0",
        uniswapV3PoolAddress: null,
        zoraComments: null,
        isFallbackToken: true
      };
      fallbackTokens.push(fallbackToken);
    }

    // Combine all tokens
    const allTokens = [...zoraTokens, ...fallbackTokens];

    return new Response(JSON.stringify({ tokens: allTokens }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch tokens";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 