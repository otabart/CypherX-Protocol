import { NextResponse } from "next/server";

type TokenData = {
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  priceChange?: { h24: number };
  volume?: { h24: number };
  marketCap?: number;
  info?: { imageUrl: string };
};

const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

async function fetchDexScreenerData(
  chainId: string,
  pairAddresses: string[]
): Promise<TokenData[]> {
  try {
    const validAddresses = pairAddresses.filter(isValidAddress);
    if (!validAddresses.length) {
      console.warn("[06/25/2025 08:10 AM PDT] No valid pair addresses provided to DEX Screener.");
      return [];
    }

    const url = `${process.env.NEXT_PUBLIC_DEXSCREENER_API_URL}/latest/pairs/${chainId}/${validAddresses.join(",")}`;
    console.log("[06/25/2025 08:10 AM PDT] Fetching DEX Screener data from:", url);

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.error("[06/25/2025 08:10 AM PDT] DEX Screener request failed:", res.status, res.statusText);
      return [];
    }

    const raw = await res.json();
    console.log("[06/25/2025 08:10 AM PDT] DEX Screener raw response:", JSON.stringify(raw, null, 2));

    if (!raw.pairs || !Array.isArray(raw.pairs)) {
      console.warn("[06/25/2025 08:10 AM PDT] DEX Screener response has no pairs or is not an array.");
      return [];
    }

    const pairs = raw.pairs as { pairAddress: string; baseToken: { address: string; name: string; symbol: string }; priceUsd: number; priceChange: { h24: number }; volume: { h24: number }; marketCap: number; logoUrl?: string }[];
    console.log("[06/25/2025 08:10 AM PDT] Processed pairs:", pairs.length);

    return pairs.map((p) => ({
      pairAddress: p.pairAddress.toLowerCase(),
      baseToken: {
        address: p.baseToken.address,
        name: p.baseToken.name || "Unknown",
        symbol: p.baseToken.symbol || "UNK",
      },
      priceUsd: p.priceUsd ? String(p.priceUsd) : "0",
      priceChange: p.priceChange ? { h24: p.priceChange.h24 || 0 } : undefined,
      volume: p.volume ? { h24: p.volume.h24 || 0 } : undefined,
      marketCap: p.marketCap || 0,
      info: p.logoUrl ? { imageUrl: p.logoUrl } : undefined,
    }));
  } catch (err) {
    console.error("[06/25/2025 08:10 AM PDT] fetchDexScreenerData error:", err);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const chainId = url.searchParams.get("chainId") ?? "";
    const tokenAddresses = url.searchParams.get("tokenAddresses") ?? "";

    if (chainId !== "base" || !tokenAddresses) {
      console.warn("[06/25/2025 08:10 AM PDT] Invalid query params:", { chainId, tokenAddresses });
      return NextResponse.json({ error: "Missing or unsupported query params" }, { status: 400 });
    }

    const addresses = tokenAddresses.split(",").map((a) => a.trim().toLowerCase());
    console.log("[06/25/2025 08:10 AM PDT] Processing addresses:", addresses);

    const tokenData = await fetchDexScreenerData(chainId, addresses);
    console.log("[06/25/2025 08:10 AM PDT] Returning token data:", tokenData);

    return NextResponse.json(tokenData);
  } catch (err) {
    console.error("[06/25/2025 08:10 AM PDT] Error in /api/indexes:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}



