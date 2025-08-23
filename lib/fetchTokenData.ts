// lib/fetchTokenData.ts
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export interface TokenData {
  poolAddress: string;
  secondaryPoolAddress?: string;
  tokenAddress: string;
  symbol: string;
  name: string; // Optional for now
  decimals?: number; // Make optional
  priceUsd?: string;
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
  liquidity?: {
    usd: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
}

// Define a basic type for DexScreener pair data
interface DexScreenerPair {
  pairAddress?: string;
  baseToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  quoteToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  priceUsd?: string;
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
  liquidity?: {
    usd: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
}

export const fetchAllTokenData = async (): Promise<TokenData[]> => {
  try {
    const tokensRef = collection(db, "tokens");
    const querySnapshot = await getDocs(tokensRef);

    if (querySnapshot.empty) {
      console.warn("No tokens found in Firebase 'tokens' collection.");
      return [];
    }

    const tokenList = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      console.log("Raw Firebase token data:", data); // Debug log
      return {
        poolAddress: (data.pool as string) || (data.pair as string) || "",
        secondaryPoolAddress: (data.pool2 as string) || (data.pair2 as string) || "",
        tokenAddress: data.address as string || "",
        symbol: data.symbol as string || "",
        name: data.name as string || data.symbol || "Unknown", // Fallback to symbol if name is missing
        decimals: data.decimals as number || 18, // Default to 18 if missing
      };
    });

    if (tokenList.length === 0) {
      console.warn("Token list is empty after mapping.");
      return [];
    }

    console.log("Mapped token list:", tokenList); // Debug the mapped data

    const tokenChunks: string[][] = [];
    for (let i = 0; i < tokenList.length; i += 10) {
      tokenChunks.push(tokenList.slice(i, i + 10).map((t) => t.tokenAddress));
    }

    const allResults: TokenData[] = [];
    for (const chunk of tokenChunks) {
      const joinedChunk = chunk.join(",");
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
        { headers: { Accept: "application/json" } }
      );
      console.log("DexScreener response status:", res.status, "URL:", res.url);
      if (!res.ok) {
        console.error(
          `DexScreener API fetch failed for chunk: ${joinedChunk}, status: ${res.status}, body:`,
          await res.text()
        );
        // Fallback to Firebase data if API fails
        allResults.push(...tokenList.map((t) => ({ ...t, priceUsd: "0", priceChange: { h24: 0 } })));
        continue;
      }
      const data = await res.json();
      console.log("DexScreener response data:", data);
      if (Array.isArray(data)) {
        allResults.push(
          ...data.map((pair: DexScreenerPair) => {
            const firestoreToken = tokenList.find(
              (t) => pair.baseToken?.address && t.tokenAddress.toLowerCase() === pair.baseToken.address.toLowerCase()
            );
            return firestoreToken
              ? {
                  ...firestoreToken,
                  poolAddress: pair.pairAddress || firestoreToken.poolAddress || "",
                  priceUsd: pair.priceUsd || "0",
                  priceChange: pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
                  volume: pair.volume || { h1: 0, h24: 0 },
                  liquidity: pair.liquidity || { usd: 0 },
                  marketCap: pair.marketCap || 0,
                  info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
                }
              : {
                  poolAddress: pair.pairAddress || "",
                  tokenAddress: pair.baseToken?.address || "",
                  symbol: pair.baseToken?.symbol || "UNK",
                  name: pair.baseToken?.name || "Unknown",
                  decimals: 18,
                  priceUsd: pair.priceUsd || "0",
                  priceChange: pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
                  volume: pair.volume || { h1: 0, h24: 0 },
                  liquidity: pair.liquidity || { usd: 0 },
                  marketCap: pair.marketCap || 0,
                  info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
                };
          })
        );
      } else {
        console.warn("DexScreener response is not an array:", data);
        // Fallback to Firebase data
        allResults.push(...tokenList.map((t) => ({ ...t, priceUsd: "0", priceChange: { h24: 0 } })));
      }
    }

    console.log("Fetched token data:", allResults);
    return allResults.length > 0 ? allResults : tokenList.map((t) => ({ ...t, priceUsd: "0", priceChange: { h24: 0 } }));
  } catch (error) {
    console.error("Error fetching token data:", error);
    return [];
  }
};

export const getTopPerformingCoins = (tokens: TokenData[]): TokenData[] => {
  // Group by tokenAddress and select the pool with highest liquidity
  const bestByToken = new Map<string, TokenData>();
  for (const t of tokens) {
    const key = t.tokenAddress?.toLowerCase();
    if (!key) continue;
    const current = bestByToken.get(key);
    if (!current) {
      bestByToken.set(key, t);
      continue;
    }
    const currLiq = current.liquidity?.usd || 0;
    const nextLiq = t.liquidity?.usd || 0;
    if (nextLiq > currLiq) {
      bestByToken.set(key, t);
    }
  }
  const deduped = Array.from(bestByToken.values());
  return deduped
    .sort((a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0))
    .slice(0, 10);
};