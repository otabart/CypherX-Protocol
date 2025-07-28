// app/api/tokens/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chainId") || "base";
  const tokenAddresses = searchParams.get("tokenAddresses")?.split(",");
  const poolAddress = searchParams.get("poolAddress");
  const fetchChartData = searchParams.get("fetchChartData") === "true";
  const timeframe = searchParams.get("timeframe") || "hour"; // Default to hour

  if (!chainId || (!tokenAddresses && !poolAddress && !fetchChartData)) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Handle tokenAddresses with DexScreener (original logic)
    if (tokenAddresses) {
      const baseURL = process.env.NEXT_PUBLIC_DEXSCREENER_API_URL;
      if (!baseURL) {
        console.error("NEXT_PUBLIC_DEXSCREENER_API_URL is not set.");
        return NextResponse.json(
          { error: "Server misconfiguration: DexScreener API URL not set" },
          { status: 500 }
        );
      }

      const endpoint = `${baseURL}/tokens/v1/${chainId}/${tokenAddresses.join(",")}`;
      console.log("Fetching DexScreener tokens endpoint:", endpoint);

      const res = await fetch(endpoint);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("DexScreener API error:", errorText);
        return NextResponse.json(
          { error: `DexScreener API error: ${errorText}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      console.log("Raw DexScreener token data:", data);

      return NextResponse.json(data, { status: 200 });
    }

    // Handle poolAddress with GeckoTerminal (for metadata)
    if (poolAddress && !fetchChartData) {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${chainId}/pools/${poolAddress}`
      );
      if (!res.ok) {
        const errorText = await res.text();
        console.error("GeckoTerminal API error for pool:", errorText);
        return NextResponse.json(
          { error: `GeckoTerminal API error: ${errorText}` },
          { status: res.status }
        );
      }
      const poolData = await res.json();
      console.log("Raw GeckoTerminal pool data:", poolData);

      if (!poolData.data) {
        console.error("No pool data returned for poolAddress:", poolAddress);
        return NextResponse.json(
          { error: "No pool data found for the given address" },
          { status: 404 }
        );
      }

      const pool = poolData.data;
      const tokenData = [{
        pairAddress: pool.attributes.address,
        baseToken: {
          name: pool.attributes.base_token_name || "Unknown",
          symbol: pool.attributes.base_token_symbol || "UNK",
        },
        quoteToken: {
          name: pool.attributes.quote_token_name || "WETH",
          symbol: pool.attributes.quote_token_symbol || "WETH",
        },
        priceUsd: pool.attributes.price_usd || "0",
        txns: pool.attributes.transactions || { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
        priceChange: pool.attributes.price_change || { h1: 0, h6: 0, h24: 0 },
        volume: pool.attributes.volume || { h24: 0 },
        liquidity: pool.attributes.liquidity || { usd: 0 },
        marketCap: pool.attributes.market_cap || 0,
        fdv: pool.attributes.fdv || 0,
        pairCreatedAt: pool.attributes.created_at || Date.now(),
      }];

      return NextResponse.json(tokenData, { status: 200 });
    }

    // Handle chart data fetching with GeckoTerminal
    if (poolAddress && fetchChartData) {
      const timeframeParam = timeframe === "minute" ? "minute" : timeframe === "day" ? "day" : "hour";
      const aggregate = timeframe === "minute" ? "5" : "1"; // 5-minute candles for minute timeframe, 1-hour/day for others
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${chainId}/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}`
      );
      if (!res.ok) {
        const errorText = await res.text();
        console.error("GeckoTerminal API error for chart data:", errorText);
        return NextResponse.json(
          { error: `GeckoTerminal API error: ${errorText}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      console.log("GeckoTerminal chart data:", data);

      if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
        console.error("No chart data returned for poolAddress:", poolAddress);
        return NextResponse.json(
          { error: "No chart data found for the given address" },
          { status: 404 }
        );
      }

      return NextResponse.json(data, { status: 200 });
    }

    return NextResponse.json({ error: "No valid parameters provided" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error in tokens API route:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}