import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Reused TokenData type from TokenScreener
export type TokenData = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  marketCap?: number;
  liquidity: {
    usd: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
  };
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  trendingScore?: number;
  boosted?: boolean;
  boostValue?: number;
  weight?: number;
};

// Reused computeTrending function from TokenScreener
function computeTrending(token: TokenData, boostValue: number): number {
  const getTxns24h = (token: TokenData): number => {
    if (!token.txns || !token.txns.h24) return 0;
    const { buys, sells } = token.txns.h24;
    return buys + sells;
  };

  const DECAY_CONSTANT = 7;
  const txns = getTxns24h(token);
  let txnScore = Math.log10(txns + 1) * 1.5;
  if (txns < 10) txnScore *= 0.3;
  else if (txns < 50) txnScore *= 0.7;
  const volumeScore = Math.log10((token.volume?.h24 || 0) + 1) * 0.5;
  const liquidityScore = Math.log10((token.liquidity?.usd || 0) + 1) * 0.3;
  const priceChange1h = token.priceChange?.h1 ?? 0;
  const priceChange6h = token.priceChange?.h6 ?? 0;
  const priceChange24h = token.priceChange?.h24 ?? 0;
  const priceMovementScore =
    (priceChange1h > 0 ? Math.log10(Math.abs(priceChange1h) + 1) * 2 : 0) +
    (priceChange6h > 0 ? Math.log10(Math.abs(priceChange6h) + 1) * 2 : 0) +
    (priceChange24h > 0 ? Math.log10(Math.abs(priceChange24h) + 1) * 2 : 0);
  const consistencyBonus = priceChange1h > 0 && priceChange6h > 0 && priceChange24h > 0 ? 10 : 0;
  const volumeToMarketCap = token.marketCap ? (token.volume?.h24 || 0) / token.marketCap : 0;
  const volumeMarketCapScore = Math.log10(volumeToMarketCap + 1) * 2;
  const boostScore = boostValue || 0;
  const ageDecay = token.pairCreatedAt
    ? Math.max(0.3, Math.exp(-(Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24) / DECAY_CONSTANT))
    : 0.5;
  const baseScore =
    txnScore +
    volumeScore +
    liquidityScore +
    priceMovementScore +
    consistencyBonus +
    volumeMarketCapScore +
    boostScore;
  return token.pairCreatedAt ? baseScore * ageDecay : baseScore * 0.8;
}

export async function GET() {
  try {
    // Fetch tokens from Firebase
    const tokensSnapshot = await getDocs(collection(db, "tokens"));
    const tokenList = tokensSnapshot.docs.map((doc) => ({
      pool: doc.data().pool as string,
      symbol: doc.data().symbol as string,
      address: doc.data().address as string,
      name: doc.data().name as string | undefined,
      createdAt: doc.data().createdAt?.toDate().getTime() || 0,
      docId: doc.id,
    }));

    // Filter valid Ethereum addresses
    const validTokens = tokenList.filter((token) => /^0x[a-fA-F0-9]{40}$/.test(token.address));
    if (validTokens.length === 0) {
      return NextResponse.json({ error: "No valid token addresses found" }, { status: 404 });
    }

    // Fetch token data from DexScreener in chunks
    const tokenChunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 10) {
      tokenChunks.push(validTokens.slice(i, i + 10).map((t) => t.address));
    }

    const allResults: TokenData[] = [];
    for (const chunk of tokenChunks) {
      const joinedChunk = chunk.join(",");
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
        {
          headers: { Accept: "application/json" },
        }
      );

      if (!res.ok) {
        console.error(`DexScreener API failed for chunk: ${joinedChunk}, status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        allResults.push(
          ...data.map((pair: any) => {
            const firestoreToken = validTokens.find(
              (t) => t.address.toLowerCase() === pair.baseToken.address.toLowerCase()
            );
            return {
              chainId: pair.chainId || "base",
              dexId: pair.dexId || "",
              pairAddress: firestoreToken?.pool || "",
              baseToken: {
                address: pair.baseToken.address || "",
                name: firestoreToken?.name || pair.baseToken.name || "Unknown",
                symbol: firestoreToken?.symbol || pair.baseToken.symbol || "UNK",
              },
              quoteToken: {
                address: pair.quoteToken.address || "",
                name: pair.quoteToken.name || "WETH",
                symbol: pair.quoteToken.symbol || "WETH",
              },
              priceUsd: pair.priceUsd || "0",
              txns: pair.txns || {
                h1: { buys: 0, sells: 0 },
                h6: { buys: 0, sells: 0 },
                h24: { buys: 0, sells: 0 },
              },
              priceChange: pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
              volume: pair.volume || { h1: 0, h24: 0 },
              liquidity: pair.liquidity || { usd: 0 },
              marketCap: pair.marketCap || 0,
              fdv: pair.fdv || 0,
              pairCreatedAt: firestoreToken?.createdAt || pair.pairCreatedAt || 0,
              info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
              isIncomplete: !pair.priceUsd || !pair.liquidity.usd,
            };
          })
        );
      }
    }

    // Fetch boost data from Firebase
    const boostedTokens = await getDocs(collection(db, "boosts"));
    const boostMap: { [pairAddress: string]: number } = {};
    boostedTokens.forEach((doc) => {
      const data = doc.data();
      boostMap[data.pairAddress.toLowerCase()] = data.boostValue;
    });

    // Apply trending scores and boost values
    const tokensWithTrending = allResults.map((token) => ({
      ...token,
      boosted: !!boostMap[token.pairAddress.toLowerCase()],
      boostValue: boostMap[token.pairAddress.toLowerCase()] || 0,
      trendingScore: computeTrending(token, boostMap[token.pairAddress.toLowerCase()] || 0),
    }));

    // Sort by trending score and select top 10
    const topTokens = tokensWithTrending
      .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
      .slice(0, 10);

    // Format response for scrolling banners
    const response = topTokens.map((token) => ({
      symbol: token.baseToken.symbol,
      name: token.baseToken.name,
      priceUsd: token.priceUsd,
      priceChange24h: token.priceChange?.h24 || 0,
      imageUrl: token.info?.imageUrl || "/fallback.png",
      trendingScore: token.trendingScore || 0,
      pairAddress: token.pairAddress,
    }));

    // Set caching headers (5 minutes)
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error in trending-widget API:", error);
    return NextResponse.json({ error: "Failed to fetch trending tokens" }, { status: 500 });
  }
}